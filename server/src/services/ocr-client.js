const OCR_URL = process.env.OCR_URL || 'http://localhost:8000';

async function request(path, init = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OCR_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OCR ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null;
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json' };
}

export const ocrClient = {
  health: () => request('/health', {}, 3000),
  createScan: (target_type, image_paths) =>
    request('/scans', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ target_type, image_paths }),
    }),
  processScan: (remoteId) =>
    request(`/scans/${remoteId}/process`, { method: 'POST' }),
  getScan: (remoteId) => request(`/scans/${remoteId}`),
  getResult: (remoteId) => request(`/scans/${remoteId}/result`),
  deleteScan: (remoteId) =>
    request(`/scans/${remoteId}`, { method: 'DELETE' }),
  listScans: (status) =>
    request(`/scans${status ? `?status=${encodeURIComponent(status)}` : ''}`),
};