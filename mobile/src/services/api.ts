/**
 * Authenticated axios client for /api/v1.
 *
 * - Request interceptor injects `Authorization: Bearer <accessToken>`.
 * - Response interceptor: on 401 (and not the refresh call itself), it performs
 *   ONE single-flight token refresh, retries the original request once, and
 *   calls the logout handler if refresh fails.
 *
 * The auth store injects its handlers via setAccessToken / setRefreshHandler /
 * setLogoutHandler to avoid a circular import between api and the store.
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config';

let accessToken: string | null = null;

/** Resolves to a fresh access token, or null when refresh is impossible. */
type RefreshHandler = () => Promise<string | null>;
type LogoutHandler = () => Promise<void> | void;

let refreshHandler: RefreshHandler | null = null;
let logoutHandler: LogoutHandler | null = null;

/** In-flight refresh promise — shared by concurrent 401s (single-flight). */
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setRefreshHandler(fn: RefreshHandler | null): void {
  refreshHandler = fn;
}

export function setLogoutHandler(fn: LogoutHandler | null): void {
  logoutHandler = fn;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    // Only attempt refresh once per request, and only for real 401s.
    if (status === 401 && original && !original._retry) {
      original._retry = true;

      try {
        if (!refreshPromise) {
          if (!refreshHandler) {
            throw new Error('No refresh handler registered');
          }
          refreshPromise = refreshHandler().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;

        if (newToken) {
          original.headers.set('Authorization', `Bearer ${newToken}`);
          return api(original);
        }
      } catch {
        // Refresh failed — fall through to logout below.
      }

      if (logoutHandler) {
        await logoutHandler();
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Extract a human-readable message from an axios error, preferring the
 * backend's { success:false, message } envelope.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: unknown; success?: unknown }
      | undefined;
    if (data && typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }
    if (!error.response) {
      return 'Tidak dapat terhubung ke server. Periksa koneksi dan API_BASE_URL.';
    }
  }
  return fallback;
}
