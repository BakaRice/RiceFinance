import type {
  V2AuthResponse, V2RegisterRequest, V2LoginRequest, V2RefreshRequest,
  V2AssetResponse, V2CreateAssetRequest, V2UpdateAssetRequest,
  V2LiabilityResponse, V2CreateLiabilityRequest, V2UpdateLiabilityRequest,
  V2SnapshotResponse, V2CreateSnapshotRequest,
  V2OverviewResponse, V2ReportResponse, V2AIReviewResponse,
  V2ApiError, V2UserDto,
} from './v2-types';

const BASE = '/api/v2';
const AUTH_KEY = 'rice_auth_v2';

// --- Token Management ---
export function getStoredAuth(): { accessToken: string; refreshToken: string; user: V2UserDto } | null {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setStoredAuth(auth: { accessToken: string; refreshToken: string; user: V2UserDto }) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}
export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}

// --- Auto-refresh ---
let refreshPromise: Promise<{ accessToken: string; refreshToken: string; user: V2UserDto } | null> | null = null;

async function refreshTokens() {
  const stored = getStoredAuth();
  if (!stored?.refreshToken) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const auth: V2AuthResponse = await res.json();
    const newAuth = { accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user };
    setStoredAuth(newAuth);
    return newAuth;
  } catch {
    clearStoredAuth();
    return null;
  }
}

let onAuthExpired: (() => void) | null = null;
let onError: ((msg: string) => void) | null = null;
export function setAuthExpiredHandler(fn: () => void) { onAuthExpired = fn; }
export function setErrorHandler(fn: (msg: string) => void) { onError = fn; }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const stored = getStoredAuth();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (stored?.accessToken) {
    headers['Authorization'] = `Bearer ${stored.accessToken}`;
  }

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && stored?.refreshToken) {
    if (!refreshPromise) refreshPromise = refreshTokens();
    const newAuth = await refreshPromise;
    refreshPromise = null;
    if (newAuth) {
      headers['Authorization'] = `Bearer ${newAuth.accessToken}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    } else {
      onAuthExpired?.();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err: V2ApiError = await res.json();
      msg = err.error?.message || msg;
    } catch {}
    if (res.status === 401) {
      clearStoredAuth();
      onAuthExpired?.();
    }
    onError?.(msg);
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// === Auth API ===
export const auth = {
  register: (data: V2RegisterRequest) => request<V2AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: V2LoginRequest) => request<V2AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  refresh: (data: V2RefreshRequest) => request<V2AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify(data) }),
  logout: (refreshToken: string) => request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  me: () => request<V2UserDto>('/users/me'),
};

// === Finance API ===
export const finance = {
  listAssets: () => request<V2AssetResponse[]>('/finance/assets'),
  createAsset: (data: V2CreateAssetRequest) => request<V2AssetResponse>('/finance/assets', { method: 'POST', body: JSON.stringify(data) }),
  updateAsset: (id: string, data: V2UpdateAssetRequest) => request<V2AssetResponse>(`/finance/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAsset: (id: string) => request<{ ok: boolean }>(`/finance/assets/${id}`, { method: 'DELETE' }),
  listLiabilities: () => request<V2LiabilityResponse[]>('/finance/liabilities'),
  createLiability: (data: V2CreateLiabilityRequest) => request<V2LiabilityResponse>('/finance/liabilities', { method: 'POST', body: JSON.stringify(data) }),
  updateLiability: (id: string, data: V2UpdateLiabilityRequest) => request<V2LiabilityResponse>(`/finance/liabilities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLiability: (id: string) => request<{ ok: boolean }>(`/finance/liabilities/${id}`, { method: 'DELETE' }),
};

// === Snapshots API ===
export const snapshots = {
  list: () => request<V2SnapshotResponse[]>('/snapshots'),
  create: (data: V2CreateSnapshotRequest) => request<V2SnapshotResponse>('/snapshots', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id: string) => request<V2SnapshotResponse>(`/snapshots/${id}`),
};

// === Stats API ===
export const stats = {
  overview: () => request<V2OverviewResponse>('/stats/overview'),
};

// === AI API ===
export const ai = {
  latestReview: () => request<V2ReportResponse | null>('/reports/latest-ai-review'),
  generateReview: () => request<V2AIReviewResponse>('/ai/reviews', { method: 'POST' }),
};
