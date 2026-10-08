/**
 * Dashboard, reports, and notifications endpoints.
 * Uses the authenticated axios instance (services/api.ts).
 */
import { api, getApiErrorMessage } from './api';
import { ApiResponse, PageInfo } from '../types/api';

/* ------------------------------- dashboard ------------------------------- */

export interface SalesKpi {
  revenueToday: number;
  transactionCount: number;
  itemsSold: number;
  averageTransactionValue: number;
  grossProfitToday: number;
}

export interface InventoryKpi {
  totalActiveSku: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockValue: number;
}

export interface CashKpi {
  totalCashActiveShifts: number;
  cashInToday: number;
  cashOutToday: number;
  activeShiftCount: number;
  shiftsWithVarianceToday: number;
}

export interface DashboardAlert {
  type: string;
  message: string;
  count: number;
}

export interface DashboardResponse {
  sales: SalesKpi;
  inventory: InventoryKpi;
  cash: CashKpi;
  alerts: DashboardAlert[];
}

export async function getDashboard(): Promise<DashboardResponse> {
  try {
    const res = await api.get<ApiResponse<DashboardResponse>>('/dashboard');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Gagal memuat dashboard');
    }
    return res.data.data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat dashboard'));
  }
}

/* -------------------------------- reports -------------------------------- */

export interface SalesReportRow {
  invoiceNo: string;
  completedAt: string;
  cashierName: string | null;
  customerName: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  status: string;
}

export interface ProductReportRow {
  productName: string;
  sku: string;
  qtySold: number;
  revenue: number;
  discount: number;
  returnQty: number;
  netSales: number;
}

export interface InventoryReportRow {
  productName: string;
  sku: string;
  openingStock: number;
  inQty: number;
  outQty: number;
  adjustmentQty: number;
  currentStock: number;
}

export interface CashReportRow {
  shiftNo: string;
  cashierName: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashRefund: number;
  expectedCash: number;
  actualCash: number | null;
  variance: number | null;
}

export interface PurchaseReportRow {
  poNumber: string;
  supplierName: string | null;
  orderDate: string;
  total: number;
  receivedStatus: string;
  paymentStatus: string;
  status: string;
}

export interface ProfitReport {
  netSales: number;
  cogs: number;
  grossProfit: number;
  cogsEstimated: boolean;
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  cashierId?: number;
  customerId?: number;
  paymentMethodId?: number;
  status?: string;
  supplierId?: number;
  page?: number;
  size?: number;
}

function toQuery(f: ReportFilter): Record<string, string | number> {
  const q: Record<string, string | number> = {};
  if (f.startDate) q.startDate = f.startDate;
  if (f.endDate) q.endDate = f.endDate;
  if (f.cashierId) q.cashierId = f.cashierId;
  if (f.customerId) q.customerId = f.customerId;
  if (f.paymentMethodId) q.paymentMethodId = f.paymentMethodId;
  if (f.status) q.status = f.status;
  if (f.supplierId) q.supplierId = f.supplierId;
  if (f.page !== undefined) q.page = f.page;
  if (f.size !== undefined) q.size = f.size;
  return q;
}

async function getPaged<T>(
  path: string,
  filter: ReportFilter,
  fallback: string,
): Promise<{ items: T[]; pagination: PageInfo | null }> {
  try {
    const res = await api.get<ApiResponse<T[]>>(path, { params: toQuery(filter) });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || fallback);
    }
    return { items: res.data.data, pagination: res.data.pagination ?? null };
  } catch (e) {
    throw new Error(getApiErrorMessage(e, fallback));
  }
}

async function getList<T>(path: string, filter: ReportFilter, fallback: string): Promise<T[]> {
  return (await getPaged<T>(path, filter, fallback)).items;
}

export const getSalesReport = (f: ReportFilter) =>
  getPaged<SalesReportRow>('/reports/sales', f, 'Gagal memuat laporan penjualan');

export const getProductReport = (f: ReportFilter) =>
  getList<ProductReportRow>('/reports/products', f, 'Gagal memuat laporan produk');

export const getInventoryReport = (f: ReportFilter) =>
  getList<InventoryReportRow>('/reports/inventory', f, 'Gagal memuat laporan stok');

export const getCashReport = (f: ReportFilter) =>
  getList<CashReportRow>('/reports/cash', f, 'Gagal memuat laporan kas');

export const getPurchaseReport = (f: ReportFilter) =>
  getPaged<PurchaseReportRow>('/reports/purchases', f, 'Gagal memuat laporan pembelian');

export async function getProfitReport(filter: ReportFilter): Promise<ProfitReport> {
  try {
    const res = await api.get<ApiResponse<ProfitReport>>('/reports/profit', {
      params: toQuery(filter),
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Gagal memuat laporan laba');
    }
    return res.data.data;
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat laporan laba'));
  }
}

/* ----------------------------- notifications ----------------------------- */

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: number | null;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(page = 0, size = 20): Promise<{
  items: AppNotification[];
  pagination: PageInfo | null;
}> {
  try {
    const res = await api.get<ApiResponse<AppNotification[]>>('/notifications', {
      params: { page, size },
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Gagal memuat notifikasi');
    }
    return { items: res.data.data, pagination: res.data.pagination ?? null };
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat notifikasi'));
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const res = await api.get<ApiResponse<{ count: number }>>(
      '/notifications/unread-count',
    );
    if (!res.data.success || !res.data.data) return 0;
    return res.data.data.count;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: number): Promise<void> {
  try {
    await api.post(`/notifications/${id}/read`);
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menandai notifikasi'));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await api.post('/notifications/read-all');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menandai semua notifikasi'));
  }
}

/* --------------------------------- helpers ------------------------------- */

export function formatRupiah(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function todayRange(): { startDate: string; endDate: string } {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: s, endDate: s };
}

export function last7DaysRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) => {
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return { startDate: fmt(start), endDate: fmt(end) };
}
