/**
 * Purchase endpoints, using the authenticated axios instance
 * (Bearer <redacted> + 401 refresh handled in services/api.ts).
 */
import { api, getApiErrorMessage } from './api';
import { ApiResponse, PageInfo } from '../types/api';

export interface PoLine {
  id: number;
  productId: number;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  receivedQty: number;
  returnedQty: number;
}

export interface PurchaseOrder {
  id: number;
  docNo: string;
  supplierId: number;
  supplierName: string;
  status: string;
  notes: string | null;
  totalAmount: number;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  lines: PoLine[];
}

export interface GrLine {
  id: number;
  poLineId: number;
  productId: number;
  productName: string;
  receivedQty: number;
}

export interface GoodsReceipt {
  id: number;
  docNo: string;
  poId: number;
  poDocNo: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  lines: GrLine[];
}

export interface PrLine {
  id: number;
  poLineId: number;
  productId: number;
  productName: string;
  qty: number;
  unitPrice: number;
  creditAmount: number;
}

export interface PurchaseReturn {
  id: number;
  docNo: string;
  poId: number;
  poDocNo: string;
  reason: string;
  supplierCredit: number;
  createdBy: string | null;
  createdAt: string;
  lines: PrLine[];
}

export interface Supplier {
  id: number;
  supplierCode: string;
  name: string;
  phone: string | null;
  active: boolean;
}

export interface PagedResult<T> {
  items: T[];
  pagination: PageInfo | null;
}

function unwrap<T>(res: { data: ApiResponse<T> }, fallback: string): T {
  if (!res.data.success || res.data.data === null) {
    throw new Error(res.data.message || fallback);
  }
  return res.data.data;
}

function toPaged<T>(
  res: { data: ApiResponse<T[]> },
  fallback: string,
): PagedResult<T> {
  return {
    items: unwrap(res, fallback),
    pagination: res.data.pagination ?? null,
  };
}

export async function listPurchaseOrders(
  status?: string,
  page = 0,
  size = 20,
): Promise<PagedResult<PurchaseOrder>> {
  try {
    const res = await api.get<ApiResponse<PurchaseOrder[]>>(
      '/purchases/orders',
      { params: { status: status || undefined, page, size } },
    );
    return toPaged(res, 'Gagal memuat purchase order');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat purchase order'));
  }
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
  try {
    const res = await api.get<ApiResponse<PurchaseOrder>>(
      `/purchases/orders/${id}`,
    );
    return unwrap(res, 'Gagal memuat detail PO');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat detail PO'));
  }
}

export async function createPurchaseOrder(body: {
  supplierId: number;
  notes?: string;
  lines: { productId: number; qty: number; unitPrice: number }[];
}): Promise<PurchaseOrder> {
  try {
    const res = await api.post<ApiResponse<PurchaseOrder>>(
      '/purchases/orders',
      body,
    );
    return unwrap(res, 'Gagal membuat PO');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal membuat PO'));
  }
}

async function poAction(
  id: number,
  action: 'submit' | 'approve' | 'mark-ordered' | 'cancel',
  fallback: string,
): Promise<PurchaseOrder> {
  try {
    const res = await api.post<ApiResponse<PurchaseOrder>>(
      `/purchases/orders/${id}/${action}`,
    );
    return unwrap(res, fallback);
  } catch (e) {
    throw new Error(getApiErrorMessage(e, fallback));
  }
}

export const submitPurchaseOrder = (id: number) =>
  poAction(id, 'submit', 'Gagal submit PO');

export const approvePurchaseOrder = (id: number) =>
  poAction(id, 'approve', 'Gagal approve PO');

export const markOrderedPurchaseOrder = (id: number) =>
  poAction(id, 'mark-ordered', 'Gagal menandai PO terkirim');

export const cancelPurchaseOrder = (id: number) =>
  poAction(id, 'cancel', 'Gagal membatalkan PO');

export async function createGoodsReceipt(body: {
  poId: number;
  notes?: string;
  lines: { poLineId: number; receivedQty: number }[];
}): Promise<GoodsReceipt> {
  try {
    const res = await api.post<ApiResponse<GoodsReceipt>>(
      '/purchases/receipts',
      body,
    );
    return unwrap(res, 'Gagal menyimpan goods receipt');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menyimpan goods receipt'));
  }
}

export async function createPurchaseReturn(body: {
  poId: number;
  reason: string;
  lines: { poLineId: number; qty: number }[];
}): Promise<PurchaseReturn> {
  try {
    const res = await api.post<ApiResponse<PurchaseReturn>>(
      '/purchases/returns',
      body,
    );
    return unwrap(res, 'Gagal menyimpan retur pembelian');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menyimpan retur pembelian'));
  }
}

export async function listSuppliers(
  search?: string,
): Promise<Supplier[]> {
  try {
    const res = await api.get<ApiResponse<Supplier[]>>('/suppliers', {
      params: { search: search || undefined, size: 50 },
    });
    return unwrap(res, 'Gagal memuat supplier').filter(s => s.active);
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat supplier'));
  }
}

export function formatMoney(n: number): string {
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Menunggu approval',
  APPROVED: 'Approved',
  ORDERED: 'Dikirim ke supplier',
  PARTIALLY_RECEIVED: 'Diterima sebagian',
  RECEIVED: 'Diterima penuh',
  CANCELLED: 'Dibatalkan',
};

export function poStatusLabel(status: string): string {
  return PO_STATUS_LABELS[status] ?? status;
}
