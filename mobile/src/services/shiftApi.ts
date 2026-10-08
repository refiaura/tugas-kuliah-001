/**
 * Cashier shift endpoints, using the authenticated axios instance
 * (Bearer <redacted> + 401 refresh handled in services/api.ts).
 */
import { api, getApiErrorMessage } from './api';
import { ApiResponse } from '../types/api';

export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface ShiftResponse {
  id: number;
  cashierName: string | null;
  status: ShiftStatus;
  openingCash: number;
  expectedCash: number;
  actualCash: number | null;
  variance: number | null;
  openedAt: string | null;
  closedAt: string | null;
}

export interface ShiftSummary {
  shift: ShiftResponse;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
}

export interface CashMovementRequest {
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  referenceNo?: string;
}

function unwrap<T>(res: { data: ApiResponse<T> }, fallback: string): T {
  if (!res.data.success || res.data.data === null) {
    throw new Error(res.data.message || fallback);
  }
  return res.data.data;
}

/** May return null when there is no open shift for the user. */
export async function getCurrentShift(): Promise<ShiftResponse | null> {
  try {
    const res = await api.get<ApiResponse<ShiftResponse | null>>(
      '/shifts/current',
    );
    if (!res.data.success) {
      throw new Error(res.data.message || 'Gagal memuat shift aktif');
    }
    return res.data.data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat shift aktif'));
  }
}

export async function openShift(
  openingCash: number,
  notes?: string,
): Promise<ShiftResponse> {
  try {
    const res = await api.post<ApiResponse<ShiftResponse>>('/shifts/open', {
      openingCash,
      notes: notes?.trim() || undefined,
    });
    return unwrap(res, 'Gagal membuka shift');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal membuka shift'));
  }
}

export async function closeShift(
  actualCash: number,
  notes?: string,
): Promise<ShiftResponse> {
  try {
    const res = await api.post<ApiResponse<ShiftResponse>>('/shifts/close', {
      actualCash,
      notes: notes?.trim() || undefined,
    });
    return unwrap(res, 'Gagal menutup shift');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menutup shift'));
  }
}

export async function cashMovement(
  body: CashMovementRequest,
): Promise<ShiftResponse> {
  try {
    const res = await api.post<ApiResponse<ShiftResponse>>(
      '/shifts/cash-movement',
      body,
    );
    return unwrap(res, 'Gagal mencatat kas');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal mencatat kas'));
  }
}

export async function getShiftSummary(id: number): Promise<ShiftSummary> {
  try {
    const res = await api.get<ApiResponse<ShiftSummary>>(
      `/shifts/${id}/summary`,
    );
    return unwrap(res, 'Gagal memuat ringkasan shift');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat ringkasan shift'));
  }
}
