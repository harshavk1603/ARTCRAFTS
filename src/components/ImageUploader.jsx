import React, { useState, useRef } from 'react';
import { Upload, X, Check, Image as ImageIcon, Loader2, Link2 } from 'lucide-react';
import { api } from '../api';

/**
 * Boutique ImageUploader component.
 * Supports file drag-and-drop, direct file selection, and external URL input.
 * Automatically uploads to the designated endpoint and calls `onChange(url)`.
 */
export function ImageUploader({
  value = '',
  onChange,
  folder = 'products',
  endpoint = 'admin/upload-image',
  label = 'Image',
  hint = 'JPG, PNG, or WebP up to 5 MB',
  required = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('file'); // 'file' or 'url'
  const [urlInput, setUrlInput] = useState(value || '');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await api(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (res?.url) {
        onChange(res.url);
        setUrlInput(res.url);
      } else {
        throw new Error('Upload succeeded but no URL was returned.');
      }
    } catch (err) {
      setError(err.message || 'Image upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  }

  function handleClear() {
    onChange('');
    setUrlInput('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleUrlSubmit() {
    if (!urlInput.trim()) {
      onChange('');
      return;
    }
    onChange(urlInput.trim());
  }

  return (
    <div className="boutique-uploader-wrap">
      <div className="uploader-header">
        <label className="uploader-label">
          {label} {required && <span className="required">*</span>}
        </label>
        <div className="uploader-mode-toggle">
          <button
            type="button"
            className={mode === 'file' ? 'active' : ''}
            onClick={() => setMode('file')}
          >
            <Upload size={12} /> Upload File
          </button>
          <button
            type="button"
            className={mode === 'url' ? 'active' : ''}
            onClick={() => setMode('url')}
          >
            <Link2 size={12} /> Image URL
          </button>
        </div>
      </div>

      {value ? (
        <div className="uploader-preview-box">
          <img
            src={value}
            alt="Preview"
            className="uploader-preview-img"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=400&q=75';
            }}
          />
          <div className="uploader-preview-meta">
            <span className="uploader-preview-status">
              <Check size={13} /> Ready
            </span>
            <span className="uploader-preview-url" title={value}>
              {value}
            </span>
            <button
              type="button"
              className="uploader-remove-btn"
              onClick={handleClear}
              title="Remove image"
            >
              <X size={14} /> Remove Image
            </button>
          </div>
        </div>
      ) : mode === 'file' ? (
        <div
          className={`uploader-dropzone ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {uploading ? (
            <div className="uploader-loading">
              <Loader2 size={24} className="spin" />
              <span>Uploading to secure media store…</span>
            </div>
          ) : (
            <div className="uploader-prompt">
              <div className="uploader-icon-circle">
                <Upload size={18} />
              </div>
              <p className="uploader-main-text">
                <b>Click to upload</b> or drag and drop your image
              </p>
              <small className="uploader-hint-text">{hint}</small>
            </div>
          )}
        </div>
      ) : (
        <div className="uploader-url-box">
          <div className="uploader-url-input-row">
            <input
              type="url"
              placeholder="https://example.com/artisan-piece.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={handleUrlSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlSubmit(); } }}
            />
            <button type="button" className="button button-dark" onClick={handleUrlSubmit}>
              Apply
            </button>
          </div>
          <small className="uploader-hint-text">Enter any direct HTTPS image link</small>
        </div>
      )}

      {error && <p className="uploader-error-text">{error}</p>}
    </div>
  );
}
export default ImageUploader;
