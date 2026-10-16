// server/supabase.mjs – Supabase Storage + local-disk fallback (zero dependencies)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function env(key) { return (process.env[key] || '').trim(); }

function secretKey() {
  return env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
}

export function supabaseConfigured() {
  return Boolean(env('SUPABASE_URL') && secretKey());
}

const bucket = () => env('SUPABASE_STORAGE_BUCKET') || 'artcrafts-media';

async function sbFetch(path, options = {}) {
  const url = `${env('SUPABASE_URL')}${path}`;
  const key = secretKey();
  const headers = {
    authorization: `Bearer ${key}`,
    apikey: key,
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
}

/** Ensure the storage bucket exists on startup (idempotent). */
export async function ensureBucket() {
  if (!supabaseConfigured()) return;
  try {
    const res = await sbFetch(`/storage/v1/bucket/${bucket()}`);
    if (res.ok) return; // already exists
    if (res.status === 404) {
      const create = await sbFetch('/storage/v1/bucket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: bucket(), name: bucket(), public: true,
          file_size_limit: 5_242_880,
          allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      });
      if (create.ok) console.log(`Supabase bucket "${bucket()}" created.`);
      else console.warn('Supabase bucket creation failed:', await create.text());
    }
  } catch (err) {
    console.warn('Supabase bucket check skipped:', err.message);
  }
}

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const ALLOWED_MIMES = new Set(Object.keys(MIME_EXT));
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload a buffer to Supabase Storage or local disk.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} folder  e.g. 'products', 'artisans', 'gallery', 'custom-orders', 'backups'
 * @returns {{ url: string, storage: 'supabase'|'local' }}
 */
export async function uploadFile(buffer, mimeType, folder = 'uploads') {
  if (!ALLOWED_MIMES.has(mimeType)) throw new Error('File type must be JPEG, PNG, or WebP.');
  if (buffer.length > MAX_BYTES) throw new Error('File must be smaller than 5 MB.');

  const ext = MIME_EXT[mimeType] || '.bin';
  const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
  const objectPath = `${folder}/${filename}`;

  if (supabaseConfigured()) {
    const res = await sbFetch(`/storage/v1/object/${bucket()}/${objectPath}`, {
      method: 'POST',
      headers: { 'content-type': mimeType, 'x-upsert': 'true' },
      body: buffer,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => 'Upload failed');
      throw new Error(`Supabase upload error: ${err}`);
    }
    const publicUrl = `${env('SUPABASE_URL')}/storage/v1/object/public/${bucket()}/${objectPath}`;
    return { url: publicUrl, storage: 'supabase' };
  }

  // Local disk fallback
  const localDir = resolve(root, 'uploads', folder);
  mkdirSync(localDir, { recursive: true });
  writeFileSync(resolve(localDir, filename), buffer);
  return { url: `/uploads/${objectPath}`, storage: 'local' };
}

/**
 * Upload raw bytes for a database backup file (JSON/SQLite dump).
 * Backups are stored in private storage and never exposed via public URLs.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {{ location: string, storage: 'supabase'|'local', filename: string }}
 */
export async function uploadBackup(buffer, filename) {
  if (supabaseConfigured()) {
    const privateBucket = 'artcrafts-backups';
    try {
      await sbFetch('/storage/v1/bucket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: privateBucket,
          name: privateBucket,
          public: false, // Explicitly private bucket
          file_size_limit: 50 * 1024 * 1024,
          allowed_mime_types: ['application/json', 'application/octet-stream'],
        }),
      });
    } catch {}

    const res = await sbFetch(`/storage/v1/object/${privateBucket}/${filename}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-upsert': 'true' },
      body: buffer,
    });
    if (res.ok) {
      return { storage: 'supabase', location: `private:${privateBucket}/${filename}`, filename };
    }
  }

  // Local disk fallback: save to private ./data/backups/ directory (never served statically)
  const dir = resolve(root, 'data', 'backups');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, filename), buffer);
  return { storage: 'local', location: `data/backups/${filename}`, filename };
}


/**
 * Parse a multipart/form-data body manually (no dependencies).
 * Returns { fields: { name: value }, file: { buffer, mimeType, filename } | null }.
 */
export function parseMultipart(raw, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  if (!match) throw new Error('Missing multipart boundary.');
  const boundary = match[1] || match[2];
  const boundaryBuf = Buffer.from(`--${boundary}`);

  const parts = [];
  let start = raw.indexOf(boundaryBuf);
  while (start !== -1) {
    const end = raw.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (end === -1) break;
    parts.push(raw.subarray(start + boundaryBuf.length, end));
    start = end;
  }

  const fields = {};
  let file = null;

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerStr = part.subarray(0, headerEnd).toString('utf8');
    const body = part.subarray(headerEnd + 4, part.length - 2); // strip trailing \r\n

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    if (filenameMatch) {
      const ctMatch = headerStr.match(/Content-Type:\s*(\S+)/i);
      file = {
        buffer: Buffer.from(body),
        mimeType: ctMatch ? ctMatch[1].toLowerCase() : 'application/octet-stream',
        filename: filenameMatch[1],
        fieldName: name,
      };
    } else {
      fields[name] = body.toString('utf8');
    }
  }
  return { fields, file };
}

/**
 * Extract image data from a JSON body that may contain a base64 data URL.
 * @param {string} dataUrl  e.g. "data:image/png;base64,iVBOR..."
 * @returns {{ buffer: Buffer, mimeType: string } | null}
 */
export function parseBase64DataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1].toLowerCase() };
}
