import { create } from "zustand";
import type { CashRegisterResponse, CompanyProfileResponse } from "../services/api/types";

type PosSessionState = {
  registerCode: string;
  company: CompanyProfileResponse | null;
  activeCashRegister: CashRegisterResponse | null;
  setRegisterCode: (registerCode: string) => void;
  setCompany: (company: CompanyProfileResponse | null) => void;
  setActiveCashRegister: (cashRegister: CashRegisterResponse | null) => void;
  clear: () => void;
};

const STORAGE_KEY = "vetcare-pos:session";
const DEFAULT_REGISTER_CODE = "CAIXA-1";

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { registerCode: DEFAULT_REGISTER_CODE };
    }

    const parsed = JSON.parse(raw) as Partial<PosSessionState>;
    return {
      registerCode:
        typeof parsed.registerCode === "string" && parsed.registerCode.trim()
          ? parsed.registerCode.trim().toUpperCase()
          : DEFAULT_REGISTER_CODE,
    };
  } catch {
    return { registerCode: DEFAULT_REGISTER_CODE };
  }
}

const initial = loadInitialState();

function persistRegisterCode(registerCode: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ registerCode }));
}

export const usePosSessionStore = create<PosSessionState>((set) => ({
  registerCode: initial.registerCode,
  company: null,
  activeCashRegister: null,

  setRegisterCode: (registerCode) => {
    const normalized = registerCode.trim().toUpperCase() || DEFAULT_REGISTER_CODE;
    persistRegisterCode(normalized);
    set({ registerCode: normalized });
  },

  setCompany: (company) => set({ company }),

  setActiveCashRegister: (activeCashRegister) => set({ activeCashRegister }),

  clear: () => {
    persistRegisterCode(DEFAULT_REGISTER_CODE);
    set({
      registerCode: DEFAULT_REGISTER_CODE,
      company: null,
      activeCashRegister: null,
    });
  },
}));
