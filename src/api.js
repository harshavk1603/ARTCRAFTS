export async function api(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...options.headers };

  if (options.body && !isFormData && typeof options.body !== 'string') {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(path.startsWith('/api/') ? path : `/api/${path}`, {
    credentials: 'same-origin',
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
