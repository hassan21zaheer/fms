// Talks to the Laravel backend. The Vite dev server forwards /api and /storage, so the browser only ever
// sees one origin and no cross-site setup is needed.

const API_BASE = '/api/v1';
const TOKEN_KEY = 'fms_token';
const ORG_KEY = 'fms_org';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: the session just will not survive a reload
  }
}

/** The organization an owner is currently looking at (owners work across organizations). */
export function getActiveOrganizationId(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export function setActiveOrganizationId(id: string | null) {
  try {
    if (id) localStorage.setItem(ORG_KEY, id);
    else localStorage.removeItem(ORG_KEY);
  } catch {
    // ignore
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Skip attaching the owner's selected organization (organizations, plans and auth calls). */
  global?: boolean;
  /** Public endpoints must not send the token or an organization. */
  anonymous?: boolean;
}

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    params.set(key, value === true ? '1' : String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? 'GET';
  const query: Query = { ...(options.query ?? {}) };
  let body = options.body;

  const organizationId = options.anonymous || options.global ? null : getActiveOrganizationId();
  if (organizationId) {
    if (method === 'GET' || method === 'DELETE') {
      if (query.organization_id === undefined) query.organization_id = organizationId;
    } else if (body && typeof body === 'object' && !Array.isArray(body) && !(body instanceof FormData)) {
      const record = body as Record<string, unknown>;
      if (record.organization_id === undefined) body = { ...record, organization_id: Number(organizationId) };
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = options.anonymous ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    let errors: Record<string, string[]> | undefined;
    try {
      const data = await response.json();
      errors = data.errors;
      const firstField = errors ? Object.values(errors)[0]?.[0] : undefined;
      message = firstField || data.message || message;
    } catch {
      if (response.status === 429) message = 'Too many attempts. Please wait a moment.';
    }
    if (response.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('fms:unauthorized'));
    }
    throw new ApiError(message, response.status, errors);
  }

  return response;
}

export async function api<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') || '';
  return (type.includes('json') ? await response.json() : undefined) as T;
}

/** Downloads a file the backend generates (CSV, PDF, QR image) through the browser. */
export async function download(path: string, filename: string, query?: Query): Promise<void> {
  const response = await send(path, { query });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Absolute URL of a file the backend stored publicly (logos, QR images). */
export function storageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `/storage/${path.replace(/^\/+/, '')}`;
}
