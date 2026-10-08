/**
 * Shared API contract types.
 * Mirrors the backend envelope: { success, message, data, pagination? }
 */

/** Standard backend response envelope (PRD §32). */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  pagination?: PageInfo | null;
}

export interface PageInfo {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Authenticated user as returned by /auth/login and /auth/me. */
export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  roles: string[];
  /** Permission codes, e.g. "sales.create", "product.view". */
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface LoginResponseData {
  token: TokenPair;
  user: User;
}

export type RefreshResponseData = TokenPair;
