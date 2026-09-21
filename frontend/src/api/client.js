/*
 * T040 — the only place fetch() is called (Constitution III).
 *
 * The frontend reaches data exclusively through documented REST endpoints; it never touches
 * the database. Every response shape and status code here is defined in
 * specs/001-task-management-system/contracts/rest-api.md.
 */

const BASE = '/api';

/** Mirrors contracts/rest-api.md § Error body. */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed with status ${status}`);
    this.status = status;
    this.fieldErrors = body?.fieldErrors || null;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const init = {
    method,
    signal,
    // Sends the JSESSIONID session cookie established by POST /api/auth/login (R-002).
    credentials: 'include',
    headers: {},
  };

  if (body !== undefined && !(body instanceof FormData)) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    init.body = body;   // multipart upload: let the browser set the boundary
  }

  const response = await fetch(`${BASE}${path}`, init);

  if (response.status === 204) return null;

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) throw new ApiError(response.status, parsed);
  return parsed;
}

/** Appends only the parameters that were actually supplied. */
export function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, v);
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  get:    (path, opts)       => request(path, { ...opts, method: 'GET' }),
  post:   (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put:    (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch:  (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts)       => request(path, { ...opts, method: 'DELETE' }),
};
