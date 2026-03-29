import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowSquareInIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CreditCardIcon,
  DesktopTowerIcon,
  MagnifyingGlassIcon,
  ReceiptIcon,
  SpinnerGapIcon,
  TrashIcon,
  UserCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useNaming } from "../../i18n/useNaming";
import { getApiErrorMessage } from "../../services/api/errors";
import { getCurrentCashRegister, openCashRegister } from "../../services/api/cash-registers.service";
import { getCurrentCompanyProfile } from "../../services/api/company.service";
import { getAppointmentById, listAppointments } from "../../services/api/appointments.service";
import { listPets } from "../../services/api/pets.service";
import { getProductById, listProducts, lookupProductsForPos } from "../../services/api/products.service";
import { addSaleItem, createSale, getSaleByAppointment, removeSaleItem, updateSale } from "../../services/api/sales.service";
import { useAuthStore } from "../../store/auth.store";
import { showMessage } from "../../store/message.store";
import { usePosSessionStore } from "../../store/posSession.store";
import { usePosSaleStore } from "../../store/posSale.store";
import { useUiStore } from "../../store/ui.store";
import type {
  AppointmentResponse,
  PetListItemResponse,
  ProductListItemResponse,
  ProductPosLookupResponse,
  SaleResponse,
} from "../../services/api/types";
import styles from "./HomePage.module.css";

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLookupExpression(raw: string) {
  const value = raw.trim();
  const match = value.match(/^(\d+(?:[.,]\d+)?)\*(.+)$/);

  if (!match) {
    return { quantity: 1, query: value };
  }

  const quantity = Number(match[1].replace(",", "."));
  return {
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    query: match[2].trim(),
  };
}

function isExactLookupMatch(query: string, product: ProductPosLookupResponse) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;
  return (
    String(product.id) === normalized ||
    product.sku.trim().toLowerCase() === normalized ||
    product.gtinEan?.trim() === query.trim() ||
    product.gtinEanTrib?.trim() === query.trim()
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const naming = useNaming();
  const me = useAuthStore((s) => s.me);
  const cashboxTitle = naming.t("home.cashbox");
  const registerCode = usePosSessionStore((s) => s.registerCode);
  const company = usePosSessionStore((s) => s.company);
  const activeCashRegister = usePosSessionStore((s) => s.activeCashRegister);
  const setRegisterCode = usePosSessionStore((s) => s.setRegisterCode);
  const setCompany = usePosSessionStore((s) => s.setCompany);
  const setActiveCashRegister = usePosSessionStore((s) => s.setActiveCashRegister);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const activeSale = usePosSaleStore((s) => s.activeSale);
  const setActiveSale = usePosSaleStore((s) => s.setActiveSale);
  const resetSale = usePosSaleStore((s) => s.reset);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const modalInputRef = useRef<HTMLInputElement | null>(null);

  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registerCodeInput, setRegisterCodeInput] = useState(registerCode);
  const [openingAmountInput, setOpeningAmountInput] = useState("0,00");
  const [notes, setNotes] = useState("");
  const [lookupInput, setLookupInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState<ProductPosLookupResponse[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState("");
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentQuery, setAppointmentQuery] = useState("");
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentCandidatesLoading, setAppointmentCandidatesLoading] = useState(false);
  const [appointmentCandidates, setAppointmentCandidates] = useState<AppointmentResponse[]>([]);
  const [appointmentPets, setAppointmentPets] = useState<Record<number, PetListItemResponse>>({});
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentResponse | null>(null);
  const [modalAppointment, setModalAppointment] = useState<AppointmentResponse | null>(null);
  const [servicePromptOpen, setServicePromptOpen] = useState(false);
  const [servicePromptLoading, setServicePromptLoading] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState<ProductListItemResponse[]>([]);
  const [serviceSelection, setServiceSelection] = useState("");
  const [servicePriceInput, setServicePriceInput] = useState("");
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");

  useEffect(() => {
    document.title = `${cashboxTitle} • ${naming.getApp("name")}`;
  }, [cashboxTitle, naming]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setRegisterCodeInput(registerCode);
  }, [registerCode]);

  useEffect(() => {
    if (!activeCashRegister) {
      resetSale();
      setLookupResults([]);
      setSearchModalOpen(false);
      setSelectedAppointment(null);
    }
  }, [activeCashRegister, resetSale]);

  useEffect(() => {
    if (activeCashRegister) {
      setSidebarCollapsed(true);
    }
  }, [activeCashRegister, setSidebarCollapsed]);

  useEffect(() => {
    if (!searchModalOpen) return;
    const timer = window.setTimeout(() => modalInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [searchModalOpen]);

  useEffect(() => {
    if (!appointmentModalOpen) return;
    setAppointmentQuery("");
    setModalAppointment(selectedAppointment);
    void loadAppointmentCandidates();
  }, [appointmentModalOpen, selectedAppointment]);

  const focusBarcodeInput = useCallback(() => {
    window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
  }, []);

  const syncSession = useCallback(async (targetRegisterCode = registerCode) => {
    setLoading(true);
    try {
      const currentCompany = await getCurrentCompanyProfile();
      setCompany(currentCompany);

      const currentCashRegister = await getCurrentCashRegister({
        companyId: currentCompany.id,
        registerCode: targetRegisterCode,
      });

      setActiveCashRegister(currentCashRegister);
    } catch (error) {
      setCompany(null);
      setActiveCashRegister(null);
      showMessage({
        title: cashboxTitle,
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadPosSession"),
        variant: "error",
      });
    } finally {
      setLoading(false);
      focusBarcodeInput();
    }
  }, [cashboxTitle, focusBarcodeInput, naming, registerCode, setActiveCashRegister, setCompany]);

  useEffect(() => {
    void syncSession(registerCode);
  }, [registerCode, syncSession]);

  const companyName = useMemo(() => {
    if (!company) return "—";
    return company.tradeName?.trim() || company.legalName;
  }, [company]);

  const visibleAppointmentCandidates = useMemo(() => {
    const normalized = appointmentQuery.trim().toLowerCase();
    if (!normalized) {
      return appointmentCandidates;
    }

    return appointmentCandidates.filter((appointment) => {
      const pet = appointmentPets[appointment.petId];
      const fields = [
        String(appointment.id),
        appointment.appointmentType,
        appointment.status,
        pet?.name ?? "",
        pet?.tutorName ?? "",
      ];

      return fields.some((field) => field.toLowerCase().includes(normalized));
    });
  }, [appointmentCandidates, appointmentPets, appointmentQuery]);

  const filteredServiceCatalog = useMemo(() => {
    const normalized = serviceSearchQuery.trim().toLowerCase();
    if (!normalized) return serviceCatalog;

    return serviceCatalog.filter((service) =>
      [service.name, service.sku, String(service.id)].some((field) => field.toLowerCase().includes(normalized))
    );
  }, [serviceCatalog, serviceSearchQuery]);

  async function handleCheckRegister() {
    const normalized = registerCodeInput.trim().toUpperCase();
    if (!normalized) return;
    setRegisterCode(normalized);
    await syncSession(normalized);
  }

  async function handleOpenCashRegister() {
    if (!company) {
      showMessage({
        title: cashboxTitle,
        message: naming.getMessage("noCompanyConfigured"),
        variant: "warning",
      });
      return;
    }

    const normalizedRegisterCode = registerCodeInput.trim().toUpperCase();
    if (!normalizedRegisterCode) {
      showMessage({
        title: cashboxTitle,
        message: naming.t("home.openCashRegisterHelp"),
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const opened = await openCashRegister({
        companyId: company.id,
        registerCode: normalizedRegisterCode,
        openingAmount: parseMoneyInput(openingAmountInput),
        notes: notes.trim() || undefined,
      });

      setRegisterCode(normalizedRegisterCode);
      setActiveCashRegister(opened);
      setNotes("");
    } catch (error) {
      showMessage({
        title: naming.t("home.openCashRegister"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToOpenCashRegister"),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
      focusBarcodeInput();
    }
  }

  async function ensureActiveSale() {
    if (activeSale) return activeSale;
    if (!company || !activeCashRegister) {
      throw new Error("Cash register not ready");
    }

    const sale = await createSale({
      companyId: company.id,
      cashRegisterId: activeCashRegister.id,
      tutorId: selectedAppointment ? appointmentPets[selectedAppointment.petId]?.tutorId : undefined,
    });
    setActiveSale(sale);
    return sale;
  }

  async function handleAddProduct(product: ProductPosLookupResponse, quantity = 1) {
    try {
      const sale = await ensureActiveSale();
      const updated = await addSaleItem(sale.id, {
        productId: product.id,
        quantity,
      });
      setActiveSale(updated);
      setLookupInput("");
      setLookupResults([]);
      setModalQuery("");
      setSearchModalOpen(false);
    } catch (error) {
      showMessage({
        title: naming.t("home.cupom"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToAddItem"),
        variant: "error",
      });
    } finally {
      focusBarcodeInput();
    }
  }

  async function importAppointmentIntoSale(appointment: AppointmentResponse) {
    if (!company || !activeCashRegister) {
      throw new Error("Cash register not ready");
    }

    let sale: SaleResponse;
    try {
      const tutorId = appointmentPets[appointment.petId]?.tutorId;
      sale = await getSaleByAppointment(appointment.id);
      if (!sale.tutorId && tutorId) {
        sale = await updateSale(sale.id, { tutorId });
      }
    } catch {
      sale = await createSale({
        companyId: company.id,
        cashRegisterId: activeCashRegister.id,
        appointmentId: appointment.id,
        tutorId: appointmentPets[appointment.petId]?.tutorId,
      });
    }

    if (appointment.serviceProductId && !sale.items.some((item) => item.productId === appointment.serviceProductId)) {
      const product = await getProductById(appointment.serviceProductId);
      sale = await addSaleItem(sale.id, {
        productId: product.id,
        quantity: 1,
      });
      showMessage({
        title: naming.t("home.importAppointment"),
        message: naming.t("home.importedServiceAdded"),
        variant: "success",
      });
    }

    setActiveSale(sale);
    setSelectedAppointment(appointment);
    setModalAppointment(appointment);
    setAppointmentModalOpen(false);
    setAppointmentQuery("");

    const needsManualServiceCharge =
      appointment.appointmentType === "VET" &&
      !appointment.serviceProductId &&
      !sale.items.some((item) => item.itemType === "SERVICE");

    if (needsManualServiceCharge) {
      await openServicePromptForAppointment(appointment);
      return;
    }

    focusBarcodeInput();
  }

  async function openServicePromptForAppointment(appointment: AppointmentResponse) {
    setServicePromptLoading(true);
    setServiceSelection("");
    setServicePriceInput("");
    setServiceSearchQuery("");

    try {
      const products = await listProducts({
        page: 0,
        size: 300,
        sort: "name,asc",
        active: true,
      });

      setServiceCatalog(products.content ?? []);
      setServicePromptOpen(true);
      setSelectedAppointment(appointment);
    } catch (error) {
      showMessage({
        title: naming.t("home.chargeAppointmentService"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadServices"),
        variant: "error",
      });
      focusBarcodeInput();
    } finally {
      setServicePromptLoading(false);
    }
  }

  async function handleServiceSelectionChange(value: string) {
    setServiceSelection(value);
    if (!value) {
      setServicePriceInput("");
      return;
    }

    try {
      const product = await getProductById(Number(value));
      if (product.itemType !== "SERVICE") {
        showMessage({
          title: naming.t("home.chargeAppointmentService"),
          message: naming.getMessage("serviceSelectionRequired"),
          variant: "warning",
        });
        setServiceSelection("");
        setServicePriceInput("");
        return;
      }

      setServicePriceInput(product.salePrice.toFixed(2).replace(".", ","));
    } catch (error) {
      showMessage({
        title: naming.t("home.chargeAppointmentService"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadServices"),
        variant: "error",
      });
    }
  }

  async function handleConfirmServicePrompt() {
    if (!activeSale || !selectedAppointment) return;

    const productId = Number(serviceSelection);
    if (!productId) {
      showMessage({
        title: naming.t("home.chargeAppointmentService"),
        message: naming.getMessage("serviceSelectionRequired"),
        variant: "warning",
      });
      return;
    }

    const unitPrice = parseMoneyInput(servicePriceInput);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      showMessage({
        title: naming.t("home.chargeAppointmentService"),
        message: naming.getMessage("invalidServicePrice"),
        variant: "warning",
      });
      return;
    }

    setServicePromptLoading(true);
    try {
      const product = await getProductById(productId);
      if (product.itemType !== "SERVICE") {
        showMessage({
          title: naming.t("home.chargeAppointmentService"),
          message: naming.getMessage("serviceSelectionRequired"),
          variant: "warning",
        });
        return;
      }

      const updated = await addSaleItem(activeSale.id, {
        productId: product.id,
        quantity: 1,
        unitPrice,
      });

      setActiveSale(updated);
      setServicePromptOpen(false);
      setServiceSelection("");
      setServicePriceInput("");
      setServiceSearchQuery("");
      showMessage({
        title: naming.t("home.chargeAppointmentService"),
        message: naming.t("home.appointmentServiceCharged"),
        variant: "success",
      });
      focusBarcodeInput();
    } catch (error) {
      showMessage({
        title: naming.t("home.chargeAppointmentService"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToChargeAppointmentService"),
        variant: "error",
      });
    } finally {
      setServicePromptLoading(false);
    }
  }

  async function loadAppointmentCandidates() {
    setAppointmentCandidatesLoading(true);
    try {
      const [openResult, finishedResult] = await Promise.all([
        listAppointments({
          page: 0,
          size: 30,
          sort: "scheduledStartAt,desc",
          status: "OPEN",
        }),
        listAppointments({
          page: 0,
          size: 30,
          sort: "scheduledStartAt,desc",
          status: "FINISHED",
        }),
      ]);

      const merged = [...(openResult.content ?? []), ...(finishedResult.content ?? [])]
        .filter((appointment, index, array) => array.findIndex((candidate) => candidate.id === appointment.id) === index)
        .sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime())
        .slice(0, 24);

      setAppointmentCandidates(merged);

      const petsResult = await listPets({ page: 0, size: 500, sort: "name,asc", active: true });
      const nextPets = Object.fromEntries((petsResult.content ?? []).map((pet) => [pet.id, pet]));
      setAppointmentPets(nextPets);

      setModalAppointment((current) => {
        if (current) {
          return merged.find((appointment) => appointment.id === current.id) ?? current;
        }
        if (selectedAppointment) {
          return merged.find((appointment) => appointment.id === selectedAppointment.id) ?? selectedAppointment;
        }
        return merged[0] ?? null;
      });
    } catch (error) {
      showMessage({
        title: naming.t("home.appointmentImportTitle"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToImportAppointment"),
        variant: "error",
      });
    } finally {
      setAppointmentCandidatesLoading(false);
    }
  }

  async function searchProducts(rawQuery: string) {
    const query = rawQuery.trim();
    if (!query) {
      setLookupResults([]);
      return [];
    }

    const response = await lookupProductsForPos({
      query,
      active: true,
      page: 0,
      size: 12,
    });

    const content = response.content ?? [];
    setLookupResults(content);
    return content;
  }

  async function handleLookupSubmit() {
    const { quantity, query } = parseLookupExpression(lookupInput);
    if (!query) return;

    setLookupLoading(true);
    try {
      const content = await searchProducts(query);

      if (content.length > 0 && isExactLookupMatch(query, content[0])) {
        await handleAddProduct(content[0], quantity);
        return;
      }

      if (content.length === 0) {
        showMessage({
          title: naming.t("home.searchResults"),
          message: naming.getMessage("noProductsFound"),
          variant: "warning",
        });
        focusBarcodeInput();
        return;
      }

      setModalQuery(query);
      setSearchModalOpen(true);
    } catch (error) {
      showMessage({
        title: naming.t("home.searchResults"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToSearchProducts"),
        variant: "error",
      });
      focusBarcodeInput();
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleOpenSearchModal() {
    const { query } = parseLookupExpression(lookupInput);
    setSearchModalOpen(true);
    setModalQuery(query);

    if (!query) {
      setLookupResults([]);
      return;
    }

    setLookupLoading(true);
    try {
      await searchProducts(query);
    } catch (error) {
      showMessage({
        title: naming.t("home.searchResults"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToSearchProducts"),
        variant: "error",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleModalSearch() {
    setLookupLoading(true);
    try {
      const content = await searchProducts(modalQuery);
      if (content.length === 0) {
        showMessage({
          title: naming.t("home.searchResults"),
          message: naming.getMessage("noProductsFound"),
          variant: "warning",
        });
      }
    } catch (error) {
      showMessage({
        title: naming.t("home.searchResults"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToSearchProducts"),
        variant: "error",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSearchAppointment() {
    const id = Number(appointmentQuery.trim());
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }

    setAppointmentLoading(true);
    try {
      const appointment = await getAppointmentById(id);
      setModalAppointment(appointment);
      setAppointmentCandidates((current) =>
        current.some((candidate) => candidate.id === appointment.id) ? current : [appointment, ...current].slice(0, 24)
      );
    } catch (error) {
      setModalAppointment(null);
      showMessage({
        title: naming.t("home.appointmentImportTitle"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToImportAppointment"),
        variant: "error",
      });
    } finally {
      setAppointmentLoading(false);
    }
  }

  async function handleRemoveItem(itemId: number) {
    if (!activeSale) return;
    try {
      await removeSaleItem(activeSale.id, itemId);
      const nextItems = activeSale.items.filter((item) => item.id !== itemId);
      const subtotal = nextItems.reduce((sum, item) => sum + item.total, 0);
      const updatedSale: SaleResponse = {
        ...activeSale,
        items: nextItems,
        subtotal,
        total: subtotal - activeSale.discount,
        remaining: subtotal - activeSale.discount - activeSale.paidTotal,
      };
      setActiveSale(updatedSale);
    } catch (error) {
      showMessage({
        title: naming.t("home.cupom"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToRemoveItem"),
        variant: "error",
      });
    } finally {
      focusBarcodeInput();
    }
  }

  function handleGoToPayment() {
    if (!activeSale?.items.length) {
      showMessage({
        title: naming.t("home.cupom"),
        message: naming.t("home.saleDraftDescription"),
        variant: "warning",
      });
      return;
    }

    navigate(`/pagamento?saleId=${activeSale.id}`);
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <div className={styles.loadingState}>
          <SpinnerGapIcon size={22} className={styles.spin} />
          <span>{naming.getMessage("loading")}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.kicker}>{naming.t("home.operatorPanel")}</div>
          <h1>{activeCashRegister ? naming.t("home.newSale") : naming.t("home.openCashRegister")}</h1>
          <p>
            {activeCashRegister
              ? naming.t("home.saleDraftDescription")
              : naming.t("home.openCashRegisterDescription")}
          </p>
        </div>

        <div className={styles.clockPanel}>
          <div className={styles.clockValue}>{formatTime(now)}</div>
          <div className={styles.clockMeta}>{formatDate(now)}</div>
        </div>
      </header>

      <section className={styles.grid}>
        {!activeCashRegister && (
        <article className={`${styles.card} ${styles.stationCard}`}>
          <div className={styles.cardHeader}>
            <h2>{naming.t("home.station")}</h2>
            <button className={styles.secondaryButton} onClick={() => void syncSession(registerCode)} type="button">
              {naming.t("home.syncSession")}
            </button>
          </div>

          <label className={styles.field}>
            <span>{naming.t("home.registerCode")}</span>
            <input
              value={registerCodeInput}
              onChange={(e) => setRegisterCodeInput(e.target.value.toUpperCase())}
              placeholder={naming.getPlaceholder("registerCode")}
            />
          </label>

          <button className={styles.secondaryButton} onClick={() => void handleCheckRegister()} type="button">
            {naming.t("home.checkRegister")}
          </button>

          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <DesktopTowerIcon size={18} />
              <span>{naming.t("home.currentCashRegister")}</span>
              <strong>{naming.t("home.noOpenCashRegister")}</strong>
            </div>
            <div className={styles.infoRow}>
              <BuildingsIcon size={18} />
              <span>{naming.t("home.company")}</span>
              <strong>{companyName}</strong>
            </div>
            <div className={styles.infoRow}>
              <UserCircleIcon size={18} />
              <span>{naming.t("home.operator")}</span>
              <strong>{me?.name ?? me?.email ?? "—"}</strong>
            </div>
          </div>
        </article>
        )}

        {!activeCashRegister ? (
          <article className={`${styles.card} ${styles.openCard}`}>
            <div className={styles.cardHeader}>
              <h2>{naming.t("home.openCashRegister")}</h2>
              <span className={styles.badge}>{naming.t("home.noOpenCashRegister")}</span>
            </div>

            <p className={styles.cardCopy}>{naming.t("home.openCashRegisterHelp")}</p>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>{naming.t("home.currentDate")}</span>
                <input value={formatDate(now)} readOnly />
              </label>

              <label className={styles.field}>
                <span>{naming.t("home.currentTime")}</span>
                <input value={formatTime(now)} readOnly />
              </label>

              <label className={styles.field}>
                <span>{naming.t("home.openingAmount")}</span>
                <input
                  value={openingAmountInput}
                  onChange={(e) => setOpeningAmountInput(e.target.value)}
                  placeholder={naming.getPlaceholder("openingAmount")}
                  inputMode="decimal"
                />
              </label>

              <label className={styles.field}>
                <span>{naming.t("home.operator")}</span>
                <input value={me?.name ?? me?.email ?? "—"} readOnly />
              </label>
            </div>

            <label className={styles.field}>
              <span>{naming.t("home.notes")}</span>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={naming.getPlaceholder("cashNotes")}
              />
            </label>

            <div className={styles.actions}>
              <button className={styles.primaryButton} onClick={() => void handleOpenCashRegister()} disabled={submitting} type="button">
                {submitting ? naming.t("home.openingInProgress") : naming.t("home.openCashRegisterAction")}
              </button>
            </div>
          </article>
        ) : (
          <article className={`${styles.card} ${styles.liveCard} ${styles.liveCardExpanded}`}>
            <div className={styles.liveTopbar}>
              <div className={styles.liveTopbarTitle}>
                <h2>{activeSale ? naming.t("home.saleDraftReady") : naming.t("home.newSale")}</h2>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>{activeCashRegister.status}</span>
              </div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span>{naming.t("home.openingAmount")}</span>
                  <strong>{formatMoney(activeCashRegister.openingAmount)}</strong>
                </div>
                <div className={styles.metric}>
                  <span>{naming.t("home.openedAt")}</span>
                  <strong>{formatDateTime(activeCashRegister.openedAt)}</strong>
                </div>
                <div className={styles.metric}>
                  <span>{naming.t("home.total")}</span>
                  <strong>{formatMoney(activeSale?.total ?? 0)}</strong>
                </div>
              </div>
            </div>

            <div className={styles.stationMetaBar}>
              <div className={styles.stationMetaItem}>
                <DesktopTowerIcon size={16} />
                <span>{activeCashRegister.registerCode}</span>
              </div>
              <div className={styles.stationMetaItem}>
                <BuildingsIcon size={16} />
                <span>{companyName}</span>
              </div>
              <div className={styles.stationMetaItem}>
                <UserCircleIcon size={16} />
                <span>{me?.name ?? me?.email ?? "—"}</span>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={() => setAppointmentModalOpen(true)}>
                <ArrowSquareInIcon size={16} />
                <span>{naming.t("home.importAppointment")}</span>
              </button>
            </div>

            {selectedAppointment && (
              <div className={styles.appointmentBanner}>
                <div>
                  <strong>{naming.t("home.importedAppointment")}</strong>
                  <p>{naming.t("home.importedAppointmentDescription")}</p>
                </div>
                <div className={styles.appointmentFacts}>
                  <span>#{selectedAppointment.id}</span>
                  <span>{selectedAppointment.appointmentType}</span>
                  <span>{selectedAppointment.status}</span>
                  <span>{formatDateTime(selectedAppointment.scheduledStartAt)}</span>
                </div>
              </div>
            )}

            <div className={styles.lookupToolbar}>
              <div className={styles.lookupInputWrap}>
                <input
                  ref={barcodeInputRef}
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleLookupSubmit();
                    }
                  }}
                  placeholder={naming.getPlaceholder("productLookupCompact")}
                />
              </div>

              <button className={styles.searchButton} type="button" onClick={() => void handleOpenSearchModal()} title={naming.t("home.searchResults")}>
                <MagnifyingGlassIcon size={20} />
              </button>
            </div>

            <div className={`${styles.couponSection} ${!activeSale?.items.length ? styles.couponSectionEmpty : ""}`}>
              <div className={styles.couponHeader}>
                <div className={styles.couponTitle}>
                  <ReceiptIcon size={18} />
                  <span>{naming.t("home.cupom")}</span>
                </div>
                <div className={styles.couponTotals}>
                  <span>{naming.t("home.items")}: {activeSale?.items.length ?? 0}</span>
                  <strong>{formatMoney(activeSale?.total ?? 0)}</strong>
                </div>
              </div>

              {!activeSale?.items.length ? (
                <div className={styles.emptyState}>{naming.t("home.noItemsYet")}</div>
              ) : (
                <div className={styles.itemsTable}>
                  {activeSale.items.map((item, index) => (
                    <div key={item.id} className={styles.itemRow}>
                      <div className={styles.itemMain}>
                        <span className={styles.itemIndex}>{index + 1}</span>
                        <div>
                          <strong>{item.description}</strong>
                          <span>
                            {item.quantity} {item.unit} x {formatMoney(item.unitPrice)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.itemActions}>
                        <b>{formatMoney(item.total)}</b>
                        <button type="button" className={styles.iconButton} onClick={() => void handleRemoveItem(item.id)}>
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span>{naming.t("home.subtotal")}</span>
                  <strong>{formatMoney(activeSale?.subtotal ?? 0)}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>{naming.t("home.total")}</span>
                  <strong>{formatMoney(activeSale?.total ?? 0)}</strong>
                </div>
              </div>

              <div className={styles.checkoutBar}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={!activeSale?.items.length}
                  onClick={handleGoToPayment}
                >
                  <CreditCardIcon size={18} />
                  <span>{naming.t("home.goToPayment")}</span>
                </button>
              </div>
            </div>
          </article>
        )}
      </section>

      <section className={styles.footerNote}>
        <CalendarBlankIcon size={16} />
        <span>{naming.t("home.devFiscalNotice")}</span>
      </section>

      {searchModalOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSearchModalOpen(false);
              focusBarcodeInput();
            }
          }}
        >
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{naming.t("home.searchResults")}</h3>
                <p>{naming.t("home.manualSearchHint")}</p>
              </div>
              <button
                className={styles.modalClose}
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  focusBarcodeInput();
                }}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className={styles.modalSearchRow}>
              <div className={styles.lookupInputWrap}>
                <input
                  ref={modalInputRef}
                  value={modalQuery}
                  onChange={(e) => setModalQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleModalSearch();
                    }
                  }}
                  placeholder={naming.getPlaceholder("productLookup")}
                />
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => void handleModalSearch()} disabled={lookupLoading}>
                {lookupLoading ? naming.getMessage("loading") : naming.t("home.searchResults")}
              </button>
            </div>

            <div className={styles.modalResults}>
              {lookupResults.length === 0 ? (
                <div className={styles.modalEmpty}>{naming.getMessage("noProductsFound")}</div>
              ) : (
                lookupResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className={styles.modalResultItem}
                    onClick={() => void handleAddProduct(product, 1)}
                  >
                    <div>
                      <strong>{product.name}</strong>
                      <span>
                        {naming.t("home.sku")}: {product.sku} · {naming.t("home.itemCode")}: {product.id}
                      </span>
                    </div>
                    <b>{formatMoney(product.salePrice)}</b>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {appointmentModalOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setAppointmentModalOpen(false);
              focusBarcodeInput();
            }
          }}
        >
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{naming.t("home.appointmentImportTitle")}</h3>
                <p>{naming.t("home.appointmentImportDescription")}</p>
              </div>
              <button
                className={styles.modalClose}
                type="button"
                onClick={() => {
                  setAppointmentModalOpen(false);
                  focusBarcodeInput();
                }}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className={styles.modalSearchRow}>
              <div className={styles.lookupInputWrap}>
                <input
                  value={appointmentQuery}
                  onChange={(e) => setAppointmentQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSearchAppointment();
                    }
                  }}
                  placeholder={naming.getPlaceholder("appointmentLookup")}
                />
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => void handleSearchAppointment()} disabled={appointmentLoading}>
                {appointmentLoading ? naming.getMessage("loading") : naming.t("home.searchResults")}
              </button>
            </div>

            <div className={styles.modalResults}>
              <div className={styles.modalSectionLabel}>{naming.t("home.recentAppointments")}</div>

              {appointmentCandidatesLoading ? (
                <div className={styles.modalEmpty}>{naming.getMessage("loading")}</div>
              ) : visibleAppointmentCandidates.length === 0 ? (
                <div className={styles.modalEmpty}>{naming.getMessage("noAppointmentsAvailable")}</div>
              ) : (
                visibleAppointmentCandidates.map((appointment) => {
                  const pet = appointmentPets[appointment.petId];
                  const active = modalAppointment?.id === appointment.id;

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      className={`${styles.modalResultItem} ${active ? styles.modalResultItemActive : ""}`}
                      onClick={() => setModalAppointment(appointment)}
                    >
                      <div>
                        <strong>
                          #{appointment.id} · {pet?.name ?? `${naming.t("home.pet")} #${appointment.petId}`}
                        </strong>
                        <div className={styles.modalResultBadges}>
                          <span>{appointment.appointmentType}</span>
                          <span>{appointment.status}</span>
                          {pet?.tutorName ? <span>{pet.tutorName}</span> : null}
                        </div>
                        <span>{formatDateTime(appointment.scheduledStartAt)}</span>
                      </div>
                      <b>{appointment.serviceProductId ? naming.t("home.withService") : naming.t("home.noLinkedService")}</b>
                    </button>
                  );
                })
              )}

              {modalAppointment ? (
                <div className={styles.appointmentCard}>
                  <div className={styles.appointmentGrid}>
                    <div>
                      <span>{naming.t("home.appointmentId")}</span>
                      <strong>#{modalAppointment.id}</strong>
                    </div>
                    <div>
                      <span>{naming.t("home.appointmentType")}</span>
                      <strong>{modalAppointment.appointmentType}</strong>
                    </div>
                    <div>
                      <span>{naming.t("home.appointmentStatus")}</span>
                      <strong>{modalAppointment.status}</strong>
                    </div>
                    <div>
                      <span>{naming.t("home.appointmentSchedule")}</span>
                      <strong>{formatDateTime(modalAppointment.scheduledStartAt)}</strong>
                    </div>
                    <div>
                      <span>{naming.t("home.pet")}</span>
                      <strong>{appointmentPets[modalAppointment.petId]?.name ?? `#${modalAppointment.petId}`}</strong>
                    </div>
                    <div>
                      <span>{naming.t("home.tutor")}</span>
                      <strong>{appointmentPets[modalAppointment.petId]?.tutorName ?? "—"}</strong>
                    </div>
                  </div>

                  <div className={styles.appointmentActions}>
                    <button className={styles.primaryButton} type="button" onClick={() => void importAppointmentIntoSale(modalAppointment)}>
                      {naming.t("home.importAppointment")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {servicePromptOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setServicePromptOpen(false);
              focusBarcodeInput();
            }
          }}
        >
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{naming.t("home.chargeAppointmentService")}</h3>
                <p>{naming.t("home.chargeAppointmentServiceDescription")}</p>
              </div>
              <button
                className={styles.modalClose}
                type="button"
                onClick={() => {
                  setServicePromptOpen(false);
                  focusBarcodeInput();
                }}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className={styles.appointmentCard}>
              <div className={styles.appointmentGrid}>
                <div>
                  <span>{naming.t("home.appointmentId")}</span>
                  <strong>#{selectedAppointment?.id ?? "—"}</strong>
                </div>
                <div>
                  <span>{naming.t("home.pet")}</span>
                  <strong>
                    {selectedAppointment
                      ? appointmentPets[selectedAppointment.petId]?.name ?? `#${selectedAppointment.petId}`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>{naming.t("home.tutor")}</span>
                  <strong>
                    {selectedAppointment
                      ? appointmentPets[selectedAppointment.petId]?.tutorName ?? "—"
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>{naming.t("home.appointmentSchedule")}</span>
                  <strong>{selectedAppointment ? formatDateTime(selectedAppointment.scheduledStartAt) : "—"}</strong>
                </div>
              </div>
            </div>

            <div className={styles.servicePromptBody}>
              <label className={styles.field}>
                <span>{naming.t("home.searchService")}</span>
                <input
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  placeholder={naming.getPlaceholder("serviceSearch")}
                />
              </label>

              <label className={styles.field}>
                <span>{naming.t("home.service")}</span>
                <select
                  className={styles.selectField}
                  value={serviceSelection}
                  onChange={(e) => void handleServiceSelectionChange(e.target.value)}
                >
                  <option value="">{naming.t("home.selectService")}</option>
                  {filteredServiceCatalog.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {naming.t("home.itemCode")}: {service.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>{naming.t("home.servicePrice")}</span>
                <input
                  value={servicePriceInput}
                  onChange={(e) => setServicePriceInput(e.target.value)}
                  placeholder={naming.getPlaceholder("servicePrice")}
                  inputMode="decimal"
                />
              </label>
            </div>

            <div className={styles.appointmentActions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => void handleConfirmServicePrompt()}
                disabled={servicePromptLoading}
              >
                {servicePromptLoading ? naming.getMessage("loading") : naming.t("home.addServiceToCupom")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
