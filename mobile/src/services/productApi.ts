/**
 * Product & category endpoints, using the authenticated axios instance
 * (Bearer injection + 401 refresh handled in services/api.ts).
 */
import { api, getApiErrorMessage } from './api';
import { API_BASE_URL } from '../config';
import { ApiResponse, PageInfo } from '../types/api';

export interface ProductResponse {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  unitId: number | null;
  unitCode: string | null;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  active: boolean;
  imageUrl: string | null;
  variants: unknown[];
}

export interface CategoryResponse {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  active: boolean;
}

export interface ProductListParams {
  search?: string;
  categoryId?: number;
  activeOnly?: boolean;
  page?: number;
  size?: number;
}

export interface ProductListResult {
  items: ProductResponse[];
  pagination: PageInfo | null;
}

export interface CreateProductRequest {
  sku: string;
  barcode?: string;
  name: string;
  categoryId?: number;
  unitId: number;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock?: number;
  active?: boolean;
}

export interface UpdateProductRequest {
  barcode?: string;
  name?: string;
  categoryId?: number;
  unitId?: number;
  minimumStock?: number;
  active?: boolean;
}

export interface UpdatePriceRequest {
  sellingPrice: number;
  purchasePrice?: number;
  reason?: string;
}

function unwrap<T>(res: { data: ApiResponse<T> }, fallback: string): T {
  if (!res.data.success || res.data.data === null) {
    throw new Error(res.data.message || fallback);
  }
  return res.data.data;
}

export async function listProducts(
  params: ProductListParams = {},
): Promise<ProductListResult> {
  try {
    const res = await api.get<ApiResponse<ProductResponse[]>>('/products', {
      params: {
        search: params.search || undefined,
        categoryId: params.categoryId || undefined,
        activeOnly: params.activeOnly ?? true,
        page: params.page ?? 0,
        size: params.size ?? 20,
      },
    });
    return {
      items: unwrap(res, 'Gagal memuat daftar produk'),
      pagination: res.data.pagination ?? null,
    };
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat daftar produk'));
  }
}

export async function getProduct(id: number): Promise<ProductResponse> {
  try {
    const res = await api.get<ApiResponse<ProductResponse>>(
      `/products/${id}`,
    );
    return unwrap(res, 'Gagal memuat detail produk');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat detail produk'));
  }
}

export async function createProduct(
  body: CreateProductRequest,
): Promise<ProductResponse> {
  try {
    const res = await api.post<ApiResponse<ProductResponse>>(
      '/products',
      body,
    );
    return unwrap(res, 'Gagal menambah produk');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal menambah produk'));
  }
}

export async function updateProduct(
  id: number,
  body: UpdateProductRequest,
): Promise<ProductResponse> {
  try {
    const res = await api.put<ApiResponse<ProductResponse>>(
      `/products/${id}`,
      body,
    );
    return unwrap(res, 'Gagal mengubah produk');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal mengubah produk'));
  }
}

export async function updateProductPrice(
  id: number,
  body: UpdatePriceRequest,
): Promise<ProductResponse> {
  try {
    const res = await api.put<ApiResponse<ProductResponse>>(
      `/products/${id}/price`,
      body,
    );
    return unwrap(res, 'Gagal mengubah harga produk');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal mengubah harga produk'));
  }
}

export async function listCategories(): Promise<CategoryResponse[]> {
  try {
    const res = await api.get<ApiResponse<CategoryResponse[]>>(
      '/categories',
    );
    return unwrap(res, 'Gagal memuat daftar kategori');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal memuat daftar kategori'));
  }
}

/** Full URL for a product image path returned by the backend (e.g. "/uploads/products/…"). */
export function productImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null;
  }
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  return `${API_BASE_URL}${imageUrl}`;
}

export interface ImageAsset {
  uri: string;
  fileName?: string;
  type?: string;
}

export async function uploadProductImage(
  productId: number,
  asset: ImageAsset,
): Promise<ProductResponse> {
  try {
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? `product-${productId}.jpg`,
      type: asset.type ?? 'image/jpeg',
    } as unknown as Blob);
    const res = await api.post<ApiResponse<ProductResponse>>(
      `/products/${productId}/image`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return unwrap(res, 'Gagal mengunggah foto produk');
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Gagal mengunggah foto produk'));
  }
}
