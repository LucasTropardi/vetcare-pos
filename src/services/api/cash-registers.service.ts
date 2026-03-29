import { http } from "./http";
import type { CashRegisterResponse, OpenCashRegisterRequest } from "./types";

export async function getCurrentCashRegister(params: {
  companyId: number;
  registerCode: string;
}): Promise<CashRegisterResponse | null> {
  const response = await http.get<CashRegisterResponse>("/api/cash-registers/current", {
    params,
    validateStatus: (status) => status === 200 || status === 204,
  });

  return response.status === 204 ? null : response.data;
}

export async function openCashRegister(payload: OpenCashRegisterRequest): Promise<CashRegisterResponse> {
  const { data } = await http.post<CashRegisterResponse>("/api/cash-registers", payload);
  return data;
}
