import { http } from "./http";
import type { CompanyProfileResponse } from "./types";

export async function getCurrentCompanyProfile(): Promise<CompanyProfileResponse> {
  const { data } = await http.get<CompanyProfileResponse>("/api/company/current");
  return data;
}
