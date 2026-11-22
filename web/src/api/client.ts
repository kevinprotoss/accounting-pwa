export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let message = `Request failed: ${res.status}`;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        message = data.error || data.message || raw;
      } catch {
        message = raw;
      }
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}