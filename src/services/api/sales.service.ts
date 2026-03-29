import { http } from "./http";
import type {
  AddSaleItemRequest,
  CreateSaleRequest,
  FinalizeSaleRequest,
  FinalizeSaleResponse,
  PageResponse,
  SaleListItemResponse,
  SaleReceiptResponse,
  SaleResponse,
  UpdateSaleRequest,
} from "./types";

export async function createSale(payload: CreateSaleRequest): Promise<SaleResponse> {
  const { data } = await http.post<SaleResponse>("/api/sales", payload);
  return data;
}

export async function addSaleItem(saleId: number, payload: AddSaleItemRequest): Promise<SaleResponse> {
  const { data } = await http.post<SaleResponse>(`/api/sales/${saleId}/items`, payload);
  return data;
}

export async function getSale(saleId: number): Promise<SaleResponse> {
  const { data } = await http.get<SaleResponse>(`/api/sales/${saleId}`);
  return data;
}

export async function listSales(params?: {
  page?: number;
  size?: number;
  sort?: string;
  query?: string;
  tutorId?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<PageResponse<SaleListItemResponse>> {
  const { data } = await http.get<PageResponse<SaleListItemResponse>>("/api/sales", { params });
  return data;
}

export async function updateSale(saleId: number, payload: UpdateSaleRequest): Promise<SaleResponse> {
  const { data } = await http.patch<SaleResponse>(`/api/sales/${saleId}`, payload);
  return data;
}

export async function removeSaleItem(saleId: number, itemId: number): Promise<void> {
  await http.delete(`/api/sales/${saleId}/items/${itemId}`);
}

export async function getSaleByAppointment(appointmentId: number): Promise<SaleResponse> {
  const { data } = await http.get<SaleResponse>("/api/sales/by-appointment", {
    params: { appointmentId },
  });
  return data;
}

export async function finalizeSale(saleId: number, payload: FinalizeSaleRequest): Promise<FinalizeSaleResponse> {
  const { data } = await http.post<FinalizeSaleResponse>(`/api/sales/${saleId}/checkout`, payload);
  return data;
}

export async function getSaleReceipt(saleId: number): Promise<SaleReceiptResponse> {
  const { data } = await http.get<SaleReceiptResponse>(`/api/sales/${saleId}/receipt`);
  return data;
}

export async function downloadSaleXml(saleId: number): Promise<{ data: Blob; fileName: string | null }> {
  const response = await http.get<Blob>(`/api/sales/${saleId}/xml`, {
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"];
  const fileNameMatch = typeof disposition === "string" ? disposition.match(/filename="?([^"]+)"?/) : null;
  return { data: response.data, fileName: fileNameMatch?.[1] ?? null };
}

export async function cancelSale(saleId: number, reason: string): Promise<SaleResponse> {
  const { data } = await http.post<SaleResponse>(`/api/sales/${saleId}/cancel`, { reason });
  return data;
}
