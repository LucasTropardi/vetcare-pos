import { http } from "./http";
import type { PageResponse, ProductListItemResponse, ProductPosLookupResponse, ProductResponse } from "./types";

export async function listProducts(params?: {
  page?: number;
  size?: number;
  sort?: string;
  name?: string;
  active?: boolean;
}): Promise<PageResponse<ProductListItemResponse>> {
  const { data } = await http.get<PageResponse<ProductListItemResponse>>("/api/products", { params });
  return data;
}

export async function lookupProductsForPos(params?: {
  query?: string;
  page?: number;
  size?: number;
  active?: boolean;
}): Promise<PageResponse<ProductPosLookupResponse>> {
  const { data } = await http.get<PageResponse<ProductPosLookupResponse>>("/api/products/lookup", { params });
  return data;
}

export async function getProductById(id: number): Promise<ProductResponse> {
  const { data } = await http.get<ProductResponse>(`/api/products/${id}`);
  return data;
}
