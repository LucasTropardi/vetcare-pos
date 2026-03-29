import { create } from "zustand";
import type { SaleResponse } from "../services/api/types";

type PosSaleState = {
  activeSale: SaleResponse | null;
  setActiveSale: (sale: SaleResponse | null) => void;
  reset: () => void;
};

export const usePosSaleStore = create<PosSaleState>((set) => ({
  activeSale: null,
  setActiveSale: (activeSale) => set({ activeSale }),
  reset: () => set({ activeSale: null }),
}));
