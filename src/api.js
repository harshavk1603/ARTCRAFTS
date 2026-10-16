const BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');

export function setAuthToken(token) {
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('artcrafts-session-token', token);
    else localStorage.removeItem('artcrafts-session-token');
  }
}

export function getAuthToken() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('artcrafts-session-token') : null;
}

export async function api(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...options.headers };

  if (options.body && !isFormData && typeof options.body !== 'string') {
    headers['content-type'] = 'application/json';
  }

  const token = getAuthToken();
  if (token && !headers['authorization']) {
    headers['authorization'] = `Bearer ${token}`;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const apiPath = cleanPath.startsWith('/api/') ? cleanPath : `/api${cleanPath}`;
  const targetUrl = BASE_URL ? `${BASE_URL}${apiPath}` : apiPath;

  const response = await fetch(targetUrl, {
    credentials: 'include',
    ...options,
    headers,
    body: isFormData
      ? options.body
      : options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export const post = (path, body) => api(path, { method: 'POST', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });

export async function uploadImage(fileOrBlob, folder = 'products') {
  const formData = new FormData();
  formData.append('file', fileOrBlob);
  formData.append('folder', folder);
  const data = await api('admin/upload-image', {
    method: 'POST',
    body: formData,
  });
  return data.url;
}

export async function uploadReferenceImage(fileOrBlob) {
  const formData = new FormData();
  formData.append('file', fileOrBlob);
  const data = await api('upload/reference-image', {
    method: 'POST',
    body: formData,
  });
  return data.url;
}
