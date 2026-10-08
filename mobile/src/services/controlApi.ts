/**
 * Milestone 7 — Control endpoints: void/return requests, approval inbox,
 * sale returns, and the audit log. Uses the authenticated axios instance
 * (Bearer <redacted> + 401 refresh handled in services/api.ts).
 */
import { api, getApiErrorMessage } from './api';
import { ApiResponse, PageInfo } from '../types/api';

export interface ApprovalResponse {
  id: number;
  subjectType: string;
  subjectId: number;
  subjectLabel: string;
  requestedBy: string;
  reason: string;
  status: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface SaleReturnLineResponse {
  saleItemId: number;
  productName: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  condition: string;
}

export interface SaleReturnResponse {
  id: number;
  returnNo: string;
  saleId: number;
  invoiceNo: string;
  approvalId: number | null;
  reason: string;
  refundAmount: number;
  shiftId: number | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  lines: SaleReturnLineResponse[];
}

export interface AuditLogResponse {
  id: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface PagedResult<T> {
  items: T[];
  pagination: PageInfo | null;
}

export interface ReturnLineRequest {
  saleItemId: number;
  qty: number;
  condition: 'SELLABLE' | 'DAMAGED';
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

/* -------------------------------- approvals ------------------------------- */

export async function listApprovals(
  status?: string,
  page = 0,
  size = 20,
): Promise<PagedResult<ApprovalResponse>> {
  try {
    const res = await api.get<ApiResponse<ApprovalResponse[]>>(
      '/approvals',
      { params: { status: status || undefined, page, size } },
    );
    return toPaged(res, 'Gagal memuat approval');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat approval'));
  }
}

export async function approveApproval(
  id: number,
  decisionNote?: string,
): Promise<ApprovalResponse> {
  try {
    const res = await api.post<ApiResponse<ApprovalResponse>>(
      `/approvals/${id}/approve`,
      { decisionNote: decisionNote || undefined },
    );
    return unwrap(res, 'Gagal menyetujui approval');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menyetujui approval'));
  }
}

export async function rejectApproval(
  id: number,
  decisionNote?: string,
): Promise<ApprovalResponse> {
  try {
    const res = await api.post<ApiResponse<ApprovalResponse>>(
      `/approvals/${id}/reject`,
      { decisionNote: decisionNote || undefined },
    );
    return unwrap(res, 'Gagal menolak approval');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menolak approval'));
  }
}

/* ------------------------------ void & returns ---------------------------- */

export async function requestVoid(
  saleId: number,
  reason: string,
): Promise<ApprovalResponse> {
  try {
    const res = await api.post<ApiResponse<ApprovalResponse>>(
      `/sales/${saleId}/void`,
      { reason },
    );
    return unwrap(res, 'Gagal mengajukan void');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal mengajukan void'));
  }
}

export async function requestReturn(
  saleId: number,
  body: { reason: string; lines: ReturnLineRequest[] },
): Promise<SaleReturnResponse> {
  try {
    const res = await api.post<ApiResponse<SaleReturnResponse>>(
      `/sales/${saleId}/returns`,
      body,
    );
    return unwrap(res, 'Gagal mengajukan retur');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal mengajukan retur'));
  }
}

export async function listSaleReturns(
  saleId?: number,
  page = 0,
  size = 20,
): Promise<PagedResult<SaleReturnResponse>> {
  try {
    const path =
      saleId !== undefined ? `/sales/${saleId}/returns` : '/sales/returns';
    const res = await api.get<ApiResponse<SaleReturnResponse[]>>(path, {
      params: { page, size },
    });
    return toPaged(res, 'Gagal memuat retur penjualan');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat retur penjualan'));
  }
}

export async function getSaleReturn(
  returnId: number,
): Promise<SaleReturnResponse> {
  try {
    const res = await api.get<ApiResponse<SaleReturnResponse>>(
      `/sales/returns/${returnId}`,
    );
    return unwrap(res, 'Gagal memuat detail retur');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat detail retur'));
  }
}

/* -------------------------------- audit log ------------------------------- */

export async function listAuditLogs(
  entityType?: string,
  page = 0,
  size = 20,
): Promise<PagedResult<AuditLogResponse>> {
  try {
    const res = await api.get<ApiResponse<AuditLogResponse[]>>(
      '/audit-logs',
      { params: { entityType: entityType || undefined, page, size } },
    );
    return toPaged(res, 'Gagal memuat audit log');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat audit log'));
  }
}

/* --------------------------------- labels --------------------------------- */

export function approvalStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Menunggu';
    case 'APPROVED':
      return 'Disetujui';
    case 'REJECTED':
      return 'Ditolak';
    default:
      return status;
  }
}

export function saleReturnStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Menunggu approval';
    case 'APPROVED':
      return 'Disetujui';
    case 'REJECTED':
      return 'Ditolak';
    case 'COMPLETED':
      return 'Selesai';
    default:
      return status;
  }
}
