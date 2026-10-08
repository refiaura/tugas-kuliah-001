/**
 * Sales endpoints, using the authenticated axios instance
 * (Bearer <redacted> + 401 refresh handled in services/api.ts).
 */
import { api, getApiErrorMessage } from './api';
import { ApiResponse, PageInfo } from '../types/api';

export interface CheckoutItem {
  productId: number;
  variantId?: number;
  qty: number;
  discount?: number;
}

export interface CheckoutPayment {
  paymentMethodId: number;
  amount: number;
  referenceNo?: string;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
  payments: CheckoutPayment[];
  customerId?: number;
  discountTotal?: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface HoldRequest {
  items: CheckoutItem[];
  customerId?: number;
  notes?: string;
}

export interface SaleItemResponse {
  productId: number;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface SalePaymentResponse {
  paymentMethodCode: string;
  paymentMethodName: string;
  amount: number;
}

export interface SaleResponse {
  id: number;
  invoiceNo: string;
  status: string;
  customerName: string | null;
  cashierName: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  changeAmount: number;
  notes: string | null;
  completedAt: string | null;
  items: SaleItemResponse[];
  payments: SalePaymentResponse[];
}

/**
 * Payment methods seeded by backend V3 (payment_methods table).
 * Used because the backend does not expose a listing endpoint.
 */
export const PAYMENT_METHODS = [
  { id: 1, code: 'CASH', name: 'Tunai' },
  { id: 2, code: 'QRIS', name: 'QRIS' },
  { id: 3, code: 'DEBIT', name: 'Kartu Debit' },
  { id: 4, code: 'CREDIT_CARD', name: 'Kartu Kredit' },
  { id: 5, code: 'TRANSFER', name: 'Transfer Bank' },
] as const;

function unwrap<T>(res: { data: ApiResponse<T> }, fallback: string): T {
  if (!res.data.success || res.data.data === null) {
    throw new Error(res.data.message || fallback);
  }
  return res.data.data;
}

export async function checkoutSale(
  body: CheckoutRequest,
): Promise<SaleResponse> {
  try {
    const res = await api.post<ApiResponse<SaleResponse>>(
      '/sales/checkout',
      body,
    );
    return unwrap(res, 'Gagal memproses transaksi');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memproses transaksi'));
  }
}

export async function holdSale(body: HoldRequest): Promise<SaleResponse> {
  try {
    const res = await api.post<ApiResponse<SaleResponse>>(
      '/sales/hold',
      body,
    );
    return unwrap(res, 'Gagal menahan transaksi');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menahan transaksi'));
  }
}

export async function listHeldSales(): Promise<SaleResponse[]> {
  try {
    const res = await api.get<ApiResponse<SaleResponse[]>>('/sales', {
      params: { status: 'HELD', size: 50 },
    });
    return unwrap(res, 'Gagal memuat transaksi tertahan');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat transaksi tertahan'));
  }
}

export async function resumeSale(
  id: number,
  body: CheckoutRequest,
): Promise<SaleResponse> {
  try {
    const res = await api.post<ApiResponse<SaleResponse>>(
      `/sales/${id}/resume`,
      body,
    );
    return unwrap(res, 'Gagal melanjutkan transaksi');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal melanjutkan transaksi'));
  }
}

export function newIdempotencyKey(): string {
  return `pos-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
