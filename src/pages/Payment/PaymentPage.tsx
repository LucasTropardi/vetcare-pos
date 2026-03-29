import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  IdentificationCardIcon,
  NotePencilIcon,
  MoneyIcon,
  PrinterIcon,
  ReceiptIcon,
  TrashIcon,
  UserCircleIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { useNaming } from "../../i18n/useNaming";
import { getApiErrorMessage } from "../../services/api/errors";
import { getCurrentCompanyProfile } from "../../services/api/company.service";
import { getSale, getSaleReceipt, finalizeSale, cancelSale, updateSale } from "../../services/api/sales.service";
import { getTutorById, listTutors } from "../../services/api/tutors.service";
import { usePosSaleStore } from "../../store/posSale.store";
import { usePosSessionStore } from "../../store/posSession.store";
import { useUiStore } from "../../store/ui.store";
import { showMessage } from "../../store/message.store";
import { useConfirmStore } from "../../store/confirm.store";
import type {
  CheckoutPaymentRequest,
  CompanyProfileResponse,
  SaleReceiptResponse,
  SaleResponse,
  TutorListItemResponse,
  TutorResponse,
} from "../../services/api/types";
import { openReceiptPrintPreview } from "./receiptPrint";
import styles from "./PaymentPage.module.css";

type PaymentMethod = CheckoutPaymentRequest["method"];

type PaymentLine = {
  id: string;
  method: PaymentMethod;
  amountInput: string;
  notes: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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

function formatMoneyInput(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function methodLabel(naming: ReturnType<typeof useNaming>, method: PaymentMethod) {
  const map: Record<PaymentMethod, string> = {
    CASH: naming.t("payment.cash"),
    CARD: naming.t("payment.card"),
    PIX: naming.t("payment.pix"),
    OTHER: naming.t("payment.other"),
  };
  return map[method];
}

function createPaymentLine(method: PaymentMethod, amount: number) {
  return {
    id: `${method}-${crypto.randomUUID()}`,
    method,
    amountInput: amount > 0 ? formatMoneyInput(amount) : "",
    notes: "",
  };
}

export function PaymentPage() {
  const naming = useNaming();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const confirm = useConfirmStore((s) => s.confirm);

  const activeSale = usePosSaleStore((s) => s.activeSale);
  const setActiveSale = usePosSaleStore((s) => s.setActiveSale);
  const resetSale = usePosSaleStore((s) => s.reset);
  const activeCashRegister = usePosSessionStore((s) => s.activeCashRegister);
  const companyFromSession = usePosSessionStore((s) => s.company);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [sale, setSale] = useState<SaleResponse | null>(activeSale);
  const [company, setCompany] = useState<CompanyProfileResponse | null>(companyFromSession);
  const [receipt, setReceipt] = useState<SaleReceiptResponse | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<TutorResponse | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<TutorListItemResponse[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [notesModalPaymentId, setNotesModalPaymentId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const saleId = useMemo(() => {
    const queryId = Number(searchParams.get("saleId"));
    if (Number.isFinite(queryId) && queryId > 0) return queryId;
    return activeSale?.id ?? null;
  }, [activeSale?.id, searchParams]);

  useEffect(() => {
    document.title = `${naming.t("payment.title")} • ${naming.getApp("name")}`;
    setSidebarCollapsed(true);
  }, [naming, setSidebarCollapsed]);

  useEffect(() => {
    if (!saleId) {
      setLoading(false);
      return;
    }

    const currentSaleId = saleId;
    let cancelled = false;

    async function load() {
        setLoading(true);
        try {
          const [loadedSale, loadedCompany] = await Promise.all([
            getSale(currentSaleId),
            companyFromSession ? Promise.resolve(companyFromSession) : getCurrentCompanyProfile(),
          ]);

        if (cancelled) return;

        setSale(loadedSale);
        setActiveSale(loadedSale);
        setCompany(loadedCompany);

        if (loadedSale.tutorId) {
          const tutor = await getTutorById(loadedSale.tutorId);
          if (!cancelled) setSelectedTutor(tutor);
        } else if (!cancelled) {
          setSelectedTutor(null);
        }

        if (loadedSale.status === "CONFIRMED") {
          const loadedReceipt = await getSaleReceipt(loadedSale.id);
          if (!cancelled) setReceipt(loadedReceipt);
        } else if (!cancelled) {
          setReceipt(null);
        }
      } catch (error) {
        if (!cancelled) {
          showMessage({
            title: naming.t("payment.title"),
            message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadSale"),
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyFromSession, naming, saleId, setActiveSale]);

  useEffect(() => {
    if (!sale || sale.status !== "DRAFT") {
      setPayments([]);
      return;
    }

    if (sale.payments.length > 0) {
      setPayments(
        sale.payments.map((payment) => ({
          id: String(payment.id),
          method: payment.method,
          amountInput: formatMoneyInput(payment.amount),
          notes: payment.notes ?? "",
        }))
      );
      return;
    }

    if (sale.total > 0) {
      setPayments([createPaymentLine("CASH", sale.remaining || sale.total)]);
    }
  }, [sale]);

  useEffect(() => {
    if (!sale || sale.status !== "DRAFT") {
      setCustomerResults([]);
      return;
    }

    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const result = await listTutors({ query, page: 0, size: 8, active: true });
        if (!cancelled) setCustomerResults(result.content ?? []);
      } catch {
        if (!cancelled) setCustomerResults([]);
      } finally {
        if (!cancelled) setCustomerLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerQuery, sale]);

  const paymentTotals = useMemo(() => {
    const total = sale?.total ?? 0;
    const entered = payments.reduce((sum, payment) => sum + parseMoneyInput(payment.amountInput), 0);
    const cashEntered = payments
      .filter((payment) => payment.method === "CASH")
      .reduce((sum, payment) => sum + parseMoneyInput(payment.amountInput), 0);
    const applied = Math.min(entered, total);
    const pending = Math.max(total - applied, 0);
    const change = Math.max(entered - total, 0);
    return { entered, cashEntered, applied, pending, change };
  }, [payments, sale?.total]);

  const quickActions = useMemo(
    () =>
      [
        { method: "PIX" as const, icon: <WalletIcon size={18} /> },
        { method: "CARD" as const, icon: <CreditCardIcon size={18} /> },
        { method: "CASH" as const, icon: <MoneyIcon size={18} /> },
        { method: "OTHER" as const, icon: <ReceiptIcon size={18} /> },
      ].map((entry) => ({
        ...entry,
        label: methodLabel(naming, entry.method),
      })),
    [naming]
  );

  async function handleSelectTutor(tutorId: number) {
    if (!sale) return;
    try {
      const [updatedSale, tutor] = await Promise.all([
        updateSale(sale.id, { tutorId }),
        getTutorById(tutorId),
      ]);
      setSale(updatedSale);
      setActiveSale(updatedSale);
      setSelectedTutor(tutor);
      setCustomerQuery("");
      setCustomerResults([]);
    } catch (error) {
      showMessage({
        title: naming.t("payment.consumer"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToUpdateCustomer"),
        variant: "error",
      });
    }
  }

  async function handleClearTutor() {
    if (!sale) return;
    try {
      const updatedSale = await updateSale(sale.id, { clearRecipient: true });
      setSale(updatedSale);
      setActiveSale(updatedSale);
      setSelectedTutor(null);
      setCustomerQuery("");
      setCustomerResults([]);
    } catch (error) {
      showMessage({
        title: naming.t("payment.consumer"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToUpdateCustomer"),
        variant: "error",
      });
    }
  }

  function handleAddPayment(method: PaymentMethod) {
    const suggested = Math.max((sale?.total ?? 0) - paymentTotals.entered, 0);
    setPayments((current) => [...current, createPaymentLine(method, suggested)]);
  }

  function handleRemovePayment(lineId: string) {
    setPayments((current) => current.filter((line) => line.id !== lineId));
  }

  function handleUpdatePayment(lineId: string, patch: Partial<PaymentLine>) {
    setPayments((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function handleOpenPaymentNotes(lineId: string) {
    const target = payments.find((payment) => payment.id === lineId);
    setNotesModalPaymentId(lineId);
    setNotesDraft(target?.notes ?? "");
  }

  function handleSavePaymentNotes() {
    if (!notesModalPaymentId) return;
    handleUpdatePayment(notesModalPaymentId, { notes: notesDraft });
    setNotesModalPaymentId(null);
    setNotesDraft("");
  }

  function handleClosePaymentNotes() {
    setNotesModalPaymentId(null);
    setNotesDraft("");
  }

  function buildPaymentPayload() {
    const normalized = payments
      .map((payment) => ({
        method: payment.method,
        amount: Number(parseMoneyInput(payment.amountInput).toFixed(2)),
        notes: payment.notes.trim() || undefined,
      }))
      .filter((payment) => payment.amount > 0);

    const nonCash = normalized.filter((payment) => payment.method !== "CASH");
    const cash = normalized.filter((payment) => payment.method === "CASH");
    return [...nonCash, ...cash];
  }

  async function handleFinalizeSale() {
    if (!sale) return;

    const payloadPayments = buildPaymentPayload();
    if (sale.items.length === 0) {
      showMessage({
        title: naming.t("payment.title"),
        message: naming.t("payment.noItemsToCheckout"),
        variant: "warning",
      });
      return;
    }

    if (payloadPayments.length === 0) {
      showMessage({
        title: naming.t("payment.paymentMethods"),
        message: naming.t("payment.noPaymentsYet"),
        variant: "warning",
      });
      return;
    }

    const nonCashTotal = payloadPayments
      .filter((payment) => payment.method !== "CASH")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const total = sale.total;
    const entered = payloadPayments.reduce((sum, payment) => sum + payment.amount, 0);

    if (nonCashTotal - total > 0.001) {
      showMessage({
        title: naming.t("payment.paymentMethods"),
        message: naming.t("payment.finishHelp"),
        variant: "warning",
      });
      return;
    }

    if (entered + 0.001 < total) {
      showMessage({
        title: naming.t("payment.paymentMethods"),
        message: naming.t("payment.finishHelp"),
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await finalizeSale(sale.id, {
        tutorId: selectedTutor?.id,
        clearRecipient: !selectedTutor && Boolean(sale.tutorId),
        payments: payloadPayments,
      });
      setSale(result.sale);
      setReceipt(result.receipt);
      resetSale();
      window.setTimeout(() => openPrintPreview(result.receipt), 120);
      showMessage({
        title: naming.t("payment.title"),
        message: naming.t("payment.receiptReady"),
        variant: "success",
      });
    } catch (error) {
      showMessage({
        title: naming.t("payment.title"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToFinalizeSale"),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSale() {
    if (!sale) return;

    const ok = await confirm({
      title: naming.t("payment.cancelSale"),
      message: naming.t("payment.cancelReason"),
      confirmText: naming.t("payment.cancelSale"),
      cancelText: naming.getLabel("cancel"),
      danger: true,
    });

    if (!ok) return;

    setCanceling(true);
    try {
      await cancelSale(sale.id, naming.t("payment.cancelReason"));
      resetSale();
      navigate("/", { replace: true });
    } catch (error) {
      showMessage({
        title: naming.t("payment.cancelSale"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToCancelSale"),
        variant: "error",
      });
    } finally {
      setCanceling(false);
    }
  }

  function openPrintPreview(targetReceipt: SaleReceiptResponse) {
    openReceiptPrintPreview(
      targetReceipt,
      naming,
      (method) => methodLabel(naming, method),
      () =>
        showMessage({
          title: naming.t("payment.printReceipt"),
          message: naming.getMessage("unknown"),
          variant: "warning",
        })
    );
  }

  async function handleReprint() {
    if (!sale) return;
    try {
      const latestReceipt = receipt ?? (await getSaleReceipt(sale.id));
      setReceipt(latestReceipt);
      openPrintPreview(latestReceipt);
    } catch (error) {
      showMessage({
        title: naming.t("payment.reprintReceipt"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadReceipt"),
        variant: "error",
      });
    }
  }

  function handleBackToCashier() {
    resetSale();
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <div className={styles.loadingState}>{naming.getMessage("loading")}</div>
      </section>
    );
  }

  if (!saleId || !sale) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyState}>
          <h1>{naming.t("payment.title")}</h1>
          <p>{naming.t("payment.noSaleSelected")}</p>
          <button className={styles.secondaryButton} type="button" onClick={handleBackToCashier}>
            {naming.t("payment.backToCashier")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.kicker}>{naming.t("payment.saleLabel")} #{sale.id}</div>
          <h1>{naming.t("payment.title")}</h1>
          <p>{naming.t("payment.description")}</p>
        </div>
        <div className={styles.heroFacts}>
          <span>{company?.tradeName?.trim() || company?.legalName || "VetCare POS"}</span>
          <span>{activeCashRegister?.registerCode || receipt?.registerCode || "PDV"}</span>
          <span>{formatDateTime(sale.updatedAt)}</span>
        </div>
      </header>

      <section className={styles.layout}>
        <div className={styles.mainColumn}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{naming.t("payment.consumer")}</h2>
                <p>{naming.t("payment.customerHint")}</p>
              </div>
              <div className={styles.customerActions}>
                <button className={styles.secondaryButton} type="button" onClick={handleClearTutor} disabled={!sale.tutorId}>
                  {naming.t("payment.clearCustomer")}
                </button>
              </div>
            </div>

            <div className={styles.customerCard}>
              <div className={styles.customerIdentity}>
                <UserCircleIcon size={28} />
                <div>
                  <strong>
                    {selectedTutor?.name
                      ?? receipt?.customer.name
                      ?? naming.t(sale.tutorId ? "payment.identifiedCustomer" : "payment.unidentifiedCustomer")}
                  </strong>
                  <span>{selectedTutor?.document || receipt?.customer.document || naming.t("payment.unidentifiedCustomer")}</span>
                </div>
              </div>

              {sale.status === "DRAFT" ? (
                <div className={styles.customerSearch}>
                  <div className={styles.searchInput}>
                    <IdentificationCardIcon size={18} />
                    <input
                      value={customerQuery}
                      onChange={(event) => setCustomerQuery(event.target.value)}
                      placeholder={naming.t("payment.searchCustomer")}
                    />
                  </div>
                  {customerLoading ? <div className={styles.searchHint}>{naming.getMessage("loading")}</div> : null}
                  {customerResults.length > 0 ? (
                    <div className={styles.searchResults}>
                      {customerResults.map((tutor) => (
                        <button key={tutor.id} type="button" className={styles.searchResultItem} onClick={() => void handleSelectTutor(tutor.id)}>
                          <div>
                            <strong>{tutor.name}</strong>
                            <span>{tutor.document || `#${tutor.id}`}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>

          <article className={`${styles.card} ${styles.summaryCardBlock}`}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{naming.t("payment.summary")}</h2>
                <p>{naming.t("home.cupom")}</p>
              </div>
              <span className={styles.badge}>{sale.items.length} {naming.t("home.items").toLowerCase()}</span>
            </div>

            <div className={styles.itemsList}>
              {sale.items.map((item, index) => {
                const receiptItem = receipt?.items.find((candidate) => candidate.id === item.id);
                return (
                <div key={item.id} className={styles.itemRow}>
                  <div>
                      <strong>{index + 1}. {item.description}</strong>
                      <span>{item.quantity} {item.unit} x {formatMoney(item.unitPrice)}</span>
                      {receiptItem ? (
                        <span className={styles.itemFiscalMeta}>
                          {naming.t("payment.fiscalData")}: {receiptItem.ncm || "NCM —"} · {receiptItem.cfop || "CFOP 5102"} · {naming.t("payment.estimatedTaxes")} {formatMoney(receiptItem.estimatedTax)}
                        </span>
                      ) : null}
                    </div>
                    <b>{formatMoney(item.total)}</b>
                  </div>
                );
              })}
            </div>

            {sale.status === "DRAFT" ? (
              <div className={styles.primaryActionsRow}>
                <button className={styles.dangerButton} type="button" onClick={() => void handleCancelSale()} disabled={canceling}>
                  {naming.t("payment.cancelSale")}
                </button>
                <button className={styles.primaryButton} type="button" onClick={() => void handleFinalizeSale()} disabled={submitting}>
                  {submitting ? naming.getMessage("loading") : naming.t("payment.confirmSale")}
                </button>
              </div>
            ) : null}
          </article>

          {receipt ? (
            <article className={`${styles.card} ${styles.receiptReadyCard}`}>
              <div className={styles.receiptReadyHeader}>
                <div>
                  <h2>{naming.t("payment.receiptReady")}</h2>
                  <p>{receipt.notice}</p>
                </div>
                <span className={`${styles.badge} ${styles.badgeWarning}`}>{receipt.environment}</span>
              </div>

              <div className={styles.receiptReadyMeta}>
                <span>{receipt.documentLabel} {receipt.documentNumber}</span>
                <span>{naming.t("payment.receiptProtocol")}: {receipt.protocol}</span>
                <span>{naming.t("payment.receiptKey")}: {receipt.accessKey}</span>
              </div>
            </article>
          ) : null}
        </div>

        <aside className={styles.sideColumn}>
          <article className={`${styles.card} ${styles.sideCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{naming.t("payment.paymentMethods")}</h2>
                <p>{naming.t("payment.finishHelp")}</p>
              </div>
            </div>

            {sale.status === "DRAFT" ? (
              <>
                <div className={styles.quickActions}>
                  {quickActions.map((action) => (
                    <button key={action.method} className={styles.quickButton} type="button" onClick={() => handleAddPayment(action.method)}>
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.paymentsScrollArea}>
                <div className={styles.paymentsList}>
                  {payments.length === 0 ? (
                    <div className={styles.searchHint}>{naming.t("payment.noPaymentsYet")}</div>
                  ) : (
                    payments.map((payment, index) => (
                      <div key={payment.id} className={styles.paymentRow}>
                        <div className={styles.paymentHeader}>
                          <strong>{naming.t("payment.paymentLine")} {index + 1}</strong>
                          <button className={styles.iconButton} type="button" onClick={() => handleRemovePayment(payment.id)}>
                            <TrashIcon size={16} />
                          </button>
                        </div>

                        <div className={styles.paymentGrid}>
                          <label className={styles.field}>
                            <span>{naming.t("payment.paymentMethods")}</span>
                            <select
                              value={payment.method}
                              onChange={(event) => handleUpdatePayment(payment.id, { method: event.target.value as PaymentMethod })}
                            >
                              {quickActions.map((action) => (
                                <option key={action.method} value={action.method}>
                                  {action.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className={styles.field}>
                            <span>{naming.t("payment.amount")}</span>
                            <input
                              value={payment.amountInput}
                              onChange={(event) => handleUpdatePayment(payment.id, { amountInput: event.target.value })}
                              placeholder={naming.t("payment.amountPlaceholder")}
                              inputMode="decimal"
                            />
                          </label>
                        </div>
                        <div className={styles.paymentTools}>
                          <button className={styles.notesButton} type="button" onClick={() => handleOpenPaymentNotes(payment.id)}>
                            <NotePencilIcon size={16} />
                            <span>{naming.t("payment.editPaymentNotes")}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </div>
              </>
            ) : (
              <div className={styles.paymentsList}>
                {sale.payments.map((payment) => (
                  <div key={payment.id} className={styles.paymentStaticRow}>
                    <strong>{methodLabel(naming, payment.method)}</strong>
                    <span>{formatMoney(payment.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.totalsPanel}>
              <div className={styles.totalRow}>
                <span>{naming.t("home.total")}</span>
                <strong>{formatMoney(sale.total)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>{naming.t("payment.estimatedTaxes")}</span>
                <strong>{formatMoney(receipt?.estimatedTaxes.total ?? 0)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>{naming.t("payment.received")}</span>
                <strong>{formatMoney(receipt?.receivedTotal ?? paymentTotals.entered)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>{naming.t("payment.pending")}</span>
                <strong>{formatMoney(receipt ? 0 : paymentTotals.pending)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>{naming.t("payment.change")}</span>
                <strong>{formatMoney(receipt?.change ?? paymentTotals.change)}</strong>
              </div>
            </div>

            {sale.status === "CONFIRMED" ? (
              <div className={styles.footerActions}>
                <button className={styles.secondaryButton} type="button" onClick={handleBackToCashier}>
                  <ArrowLeftIcon size={18} />
                  <span>{naming.t("payment.backToCashier")}</span>
                </button>
                <button className={styles.primaryButton} type="button" onClick={() => void handleReprint()}>
                  <PrinterIcon size={18} />
                  <span>{naming.t("payment.printReceipt")}</span>
                </button>
              </div>
            ) : null}
          </article>
        </aside>
      </section>

      {notesModalPaymentId ? (
        <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && handleClosePaymentNotes()}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{naming.t("payment.notes")}</h3>
                <p>{naming.t("payment.paymentMethods")}</p>
              </div>
            </div>
            <div className={styles.modalBody}>
              <textarea
                className={styles.modalTextarea}
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                placeholder={naming.t("payment.notes")}
                rows={5}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={handleClosePaymentNotes}>
                {naming.getLabel("cancel")}
              </button>
              <button className={styles.primaryButton} type="button" onClick={handleSavePaymentNotes}>
                {naming.getLabel("confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
