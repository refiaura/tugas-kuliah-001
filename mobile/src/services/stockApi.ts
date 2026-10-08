/**
 * Inventory document endpoints, using the authenticated axios instance
 * (Bearer <redacted> + 401 refresh handled in services/api.ts).
 */
import { api, getApiErrorMessage } from './api';
import { ApiResponse, PageInfo } from '../types/api';

export interface StockBalance {
  productId: number;
  sku: string;
  name: string;
  qty: number;
  minimumStock: number;
}

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  qtyChange: number;
  movementType: string;
  location: string | null;
  referenceType: string;
  referenceId: number;
  createdBy: string | null;
  createdAt: string;
}

export interface OpnameLine {
  productId: number;
  productName: string | null;
  expectedQty: number;
  countedQty: number;
  differenceQty: number;
}

export interface OpnameResponse {
  id: number;
  docNo: string;
  status: string;
  location: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  lines: OpnameLine[];
}

export interface AdjustmentResponse {
  id: number;
  docNo: string;
  productId: number;
  productName: string;
  qtyChange: number;
  reason: string;
  createdBy: string | null;
  createdAt: string;
}

export interface TransferResponse {
  id: number;
  docNo: string;
  productId: number;
  productName: string;
  qty: number;
  fromLocation: string;
  toLocation: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
}

export interface MovementListResult {
  items: StockMovement[];
  pagination: PageInfo | null;
}

function unwrap<T>(res: { data: ApiResponse<T> }, fallback: string): T {
  if (!res.data.success || res.data.data === null) {
    throw new Error(res.data.message || fallback);
  }
  return res.data.data;
}

export async function listStockBalances(): Promise<StockBalance[]> {
  try {
    const res = await api.get<ApiResponse<StockBalance[]>>(
      '/stock/balances',
    );
    return unwrap(res, 'Gagal memuat saldo stok');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat saldo stok'));
  }
}

export async function listStockMovements(
  productId?: number,
  page = 0,
  size = 50,
): Promise<MovementListResult> {
  try {
    const res = await api.get<ApiResponse<StockMovement[]>>(
      '/stock/movements',
      { params: { productId, page, size } },
    );
    return {
      items: unwrap(res, 'Gagal memuat riwayat stok'),
      pagination: res.data.pagination ?? null,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat riwayat stok'));
  }
}

export async function submitOpname(body: {
  location?: string;
  notes?: string;
  lines: { productId: number; countedQty: number }[];
}): Promise<OpnameResponse> {
  try {
    const res = await api.post<ApiResponse<OpnameResponse>>(
      '/stock/opnames',
      body,
    );
    return unwrap(res, 'Gagal menyimpan opname');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menyimpan opname'));
  }
}

export async function submitAdjustment(body: {
  productId: number;
  qtyChange: number;
  reason: string;
}): Promise<AdjustmentResponse> {
  try {
    const res = await api.post<ApiResponse<AdjustmentResponse>>(
      '/stock/adjustments',
      body,
    );
    return unwrap(res, 'Gagal menyimpan adjustment');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menyimpan adjustment'));
  }
}

export async function submitTransfer(body: {
  productId: number;
  qty: number;
  fromLocation: string;
  toLocation: string;
  notes?: string;
}): Promise<TransferResponse> {
  try {
    const res = await api.post<ApiResponse<TransferResponse>>(
      '/stock/transfers',
      body,
    );
    return unwrap(res, 'Gagal menyimpan transfer');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menyimpan transfer'));
  }
}

export function formatQty(qty: number): string {
  return Number(qty).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
