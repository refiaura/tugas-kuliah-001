/**
 * Auth endpoints called with a plain axios instance (no interceptors),
 * so the refresh call itself never triggers the 401-refresh interceptor.
 */
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config';
import {
  ApiResponse,
  LoginResponseData,
  RefreshResponseData,
  User,
} from '../types/api';

const authClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/auth`,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResponseData> {
  const res = await authClient.post<ApiResponse<LoginResponseData>>('/login', {
    username,
    password,
  });
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'Login gagal');
  }
  return res.data.data;
}

export async function refreshRequest(
  refreshToken: string,
): Promise<RefreshResponseData> {
  const res = await authClient.post<ApiResponse<RefreshResponseData>>(
    '/refresh',
    { refreshToken },
  );
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'Refresh token gagal');
  }
  return res.data.data;
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await authClient.post<ApiResponse<null>>('/logout', { refreshToken });
}

export async function meRequest(accessToken: string): Promise<User> {
  const res = await authClient.get<ApiResponse<User>>('/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'Gagal memuat profil');
  }
  return res.data.data;
}
