import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CalendarBlankIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  ReceiptIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { getApiErrorMessage } from "../../services/api/errors";
import {
  cancelSale,
  downloadSaleXml,
  getSale,
  getSaleReceipt,
  listSales,
} from "../../services/api/sales.service";
import { showMessage } from "../../store/message.store";
import { useConfirmStore } from "../../store/confirm.store";
import { useNaming } from "../../i18n/useNaming";
import type { PageResponse, SaleListItemResponse, SaleReceiptResponse, SaleResponse, SaleStatus } from "../../services/api/types";
import { openReceiptPrintPreview } from "../Payment/receiptPrint";
import styles from "./SalesPage.module.css";

type SalesFilters = {
  dateFrom: string;
  dateTo: string;
  query: string;
  status: "ALL" | SaleStatus;
};

type SaleModalState = {
  sale: SaleResponse;
  receipt: SaleReceiptResponse | null;
  summary: SaleListItemResponse;
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

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultFilters(): SalesFilters {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return {
    dateFrom: formatDateInput(yesterday),
    dateTo: formatDateInput(today),
    query: "",
    status: "ALL",
  };
}

function methodLabel(naming: ReturnType<typeof useNaming>, method: SaleResponse["payments"][number]["method"]) {
  const map: Record<SaleResponse["payments"][number]["method"], string> = {
    CASH: naming.t("payment.cash"),
    CARD: naming.t("payment.card"),
    PIX: naming.t("payment.pix"),
    OTHER: naming.t("payment.other"),
  };
  return map[method];
}

function getStatusTone(status: SaleStatus) {
  if (status === "CONFIRMED") return styles.statusSuccess;
  if (status === "CANCELED") return styles.statusDanger;
  return styles.statusNeutral;
}

function getStatusLabel(naming: ReturnType<typeof useNaming>, status: SaleStatus) {
  if (status === "CONFIRMED") return naming.t("sales.statusConfirmed");
  if (status === "CANCELED") return naming.t("sales.statusCanceled");
  return naming.t("sales.statusDraft");
}

function getReceiptDocument(receipt: SaleReceiptResponse | null, sale: SaleResponse, summary: SaleListItemResponse) {
  return receipt?.documentNumber || summary.documentNumber || `#${summary.saleNumber ?? sale.id}`;
}

function getCustomerLabel(receipt: SaleReceiptResponse | null, summary: SaleListItemResponse) {
  return receipt?.customer.name || summary.customerName || "Consumidor não identificado";
}

function saveBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SalesPage() {
  const naming = useNaming();
  const confirm = useConfirmStore((s) => s.confirm);

  const [filters, setFilters] = useState<SalesFilters>(() => getDefaultFilters());
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [salesPage, setSalesPage] = useState<PageResponse<SaleListItemResponse>>({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 12,
  });
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleModalState | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"print" | "cancel" | "xml" | null>(null);
  const selectedSaleSummary = useMemo(
    () => salesPage.content.find((sale) => sale.id === selectedSaleId) ?? selectedSale?.summary ?? null,
    [salesPage.content, selectedSale?.summary, selectedSaleId]
  );

  useEffect(() => {
    document.title = `${naming.t("sales.title")} • ${naming.getApp("name")}`;
  }, [naming]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setListUnavailable(false);
      try {
        const response = await listSales({
          page,
          size: 12,
          query: filters.query.trim() || undefined,
          status: filters.status === "ALL" ? undefined : filters.status,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        });

        if (cancelled) return;
        setSalesPage(response);
      } catch (error) {
        if (!cancelled) {
          if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) {
            setSalesPage({
              content: [],
              totalElements: 0,
              totalPages: 0,
              number: 0,
              size: 12,
            });
            setListUnavailable(true);
            return;
          }

          showMessage({
            title: naming.t("sales.title"),
            message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadSales"),
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
  }, [filters, naming, page, refreshKey]);

  useEffect(() => {
    if (!selectedSaleId) return;
    if (!selectedSaleSummary) return;
    const summary = selectedSaleSummary;

    let cancelled = false;

    async function loadDetails() {
      setDetailsLoading(true);
      try {
        const sale = await getSale(summary.id);
        let receipt: SaleReceiptResponse | null = null;

        if (sale.status === "CONFIRMED") {
          try {
            receipt = await getSaleReceipt(sale.id);
          } catch {
            receipt = null;
          }
        }

        if (cancelled) return;
        setSelectedSale({ sale, receipt, summary });
      } catch (error) {
        if (!cancelled) {
          showMessage({
            title: naming.t("sales.detailTitle"),
            message: getApiErrorMessage(error) ?? naming.getMessage("unableToLoadSale"),
            variant: "error",
          });
          setSelectedSaleId(null);
          setSelectedSale(null);
        }
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [naming, selectedSaleId, selectedSaleSummary]);

  const pageNumbers = useMemo(() => {
    if (salesPage.totalPages <= 1) return [];
    return Array.from({ length: salesPage.totalPages }, (_, index) => index);
  }, [salesPage.totalPages]);

  function updateFilter<K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) {
    setPage(0);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleResetFilters() {
    setPage(0);
    setFilters(getDefaultFilters());
  }

  function handleOpenDetails(saleId: number) {
    setSelectedSaleId(saleId);
    setSelectedSale(null);
  }

  function handleCloseDetails() {
    setSelectedSaleId(null);
    setSelectedSale(null);
    setDetailsLoading(false);
    setActionLoading(null);
  }

  async function handlePrint() {
    if (!selectedSale?.receipt) {
      showMessage({
        title: naming.t("payment.reprintReceipt"),
        message: naming.getMessage("unableToLoadReceipt"),
        variant: "warning",
      });
      return;
    }

    setActionLoading("print");
    try {
      openReceiptPrintPreview(
        selectedSale.receipt,
        naming,
        (method) => methodLabel(naming, method),
        () =>
          showMessage({
            title: naming.t("payment.printReceipt"),
            message: naming.getMessage("unknown"),
            variant: "warning",
          })
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDownloadXml() {
    if (!selectedSale) return;

    setActionLoading("xml");
    try {
      const result = await downloadSaleXml(selectedSale.sale.id);
      const fileName = result.fileName || `venda-${selectedSale.sale.id}.xml`;
      saveBlobFile(result.data, fileName);
    } catch (error) {
      showMessage({
        title: naming.t("sales.downloadXml"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToDownloadSaleXml"),
        variant: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelSale() {
    if (!selectedSale) return;

    const ok = await confirm({
      title: naming.t("payment.cancelSale"),
      message: naming.t("sales.cancelReason"),
      confirmText: naming.t("payment.cancelSale"),
      cancelText: naming.getLabel("cancel"),
      danger: true,
    });

    if (!ok) return;

    setActionLoading("cancel");
    try {
      const updated = await cancelSale(selectedSale.sale.id, naming.t("sales.cancelReason"));
      setSelectedSale((current) =>
        current
          ? {
              ...current,
              sale: updated,
              summary: {
                ...current.summary,
                status: updated.status,
                canceledAt: updated.canceledAt,
                updatedAt: updated.updatedAt,
                canCancel: false,
              },
            }
          : current
      );
      setRefreshKey((current) => current + 1);
      showMessage({
        title: naming.t("payment.cancelSale"),
        message: naming.t("sales.cancelSuccess"),
        variant: "success",
      });
    } catch (error) {
      showMessage({
        title: naming.t("payment.cancelSale"),
        message: getApiErrorMessage(error) ?? naming.getMessage("unableToCancelSale"),
        variant: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  const canCancelSelectedSale = Boolean(
    selectedSale && selectedSale.sale.status === "CONFIRMED" && selectedSale.summary.canCancel !== false
  );

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.kicker}>{naming.t("sidebar.sales")}</div>
          <h1>{naming.t("sales.title")}</h1>
          <p>{naming.t("sales.description")}</p>
        </div>
        <div className={styles.heroPanel}>
          <span>{naming.t("sales.periodLabel")}</span>
          <strong>{filters.dateFrom} → {filters.dateTo}</strong>
          <small>{salesPage.totalElements} {naming.t("sales.resultsCount")}</small>
        </div>
      </header>

      <section className={styles.content}>
        <article className={`${styles.card} ${styles.filtersCard}`}>
          <div className={styles.cardHeader}>
            <div>
              <h2>{naming.t("sales.filtersTitle")}</h2>
              <p>{naming.t("sales.filtersDescription")}</p>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={handleResetFilters}>
              {naming.t("sales.resetFilters")}
            </button>
          </div>

          <div className={styles.filtersGrid}>
            <label className={styles.field}>
              <span>{naming.t("sales.dateFrom")}</span>
              <div className={styles.inputShell}>
                <CalendarBlankIcon size={18} />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => updateFilter("dateFrom", event.target.value)}
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>{naming.t("sales.dateTo")}</span>
              <div className={styles.inputShell}>
                <CalendarBlankIcon size={18} />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => updateFilter("dateTo", event.target.value)}
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>{naming.t("sales.customerFilter")}</span>
              <div className={styles.inputShell}>
                <MagnifyingGlassIcon size={18} />
                <input
                  value={filters.query}
                  onChange={(event) => updateFilter("query", event.target.value)}
                  placeholder={naming.t("sales.customerPlaceholder")}
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>{naming.t("sales.statusFilter")}</span>
              <div className={styles.inputShell}>
                <FunnelIcon size={18} />
                <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as SalesFilters["status"])}>
                  <option value="ALL">{naming.t("sales.statusAll")}</option>
                  <option value="CONFIRMED">{naming.t("sales.statusConfirmed")}</option>
                  <option value="CANCELED">{naming.t("sales.statusCanceled")}</option>
                  <option value="DRAFT">{naming.t("sales.statusDraft")}</option>
                </select>
              </div>
            </label>
          </div>
        </article>

        <article className={`${styles.card} ${styles.listCard}`}>
          <div className={styles.cardHeader}>
            <div>
              <h2>{naming.t("sales.listTitle")}</h2>
              <p>{naming.t("sales.listDescription")}</p>
            </div>
            <span className={styles.badge}>{salesPage.totalElements} {naming.t("sales.resultsCount")}</span>
          </div>

          {loading ? (
            <div className={styles.stateBox}>{naming.getMessage("loading")}</div>
          ) : listUnavailable ? (
            <div className={styles.stateBox}>
              <WarningCircleIcon size={24} />
              <div>
                <strong>{naming.t("sales.listUnavailableTitle")}</strong>
                <p>{naming.t("sales.listUnavailableDescription")}</p>
              </div>
            </div>
          ) : salesPage.content.length === 0 ? (
            <div className={styles.stateBox}>
              <WarningCircleIcon size={24} />
              <div>
                <strong>{naming.t("sales.emptyTitle")}</strong>
                <p>{naming.t("sales.emptyDescription")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{naming.t("payment.saleLabel")}</th>
                      <th>{naming.t("sales.customerColumn")}</th>
                      <th>{naming.t("sales.dateColumn")}</th>
                      <th>{naming.t("sales.itemsColumn")}</th>
                      <th>{naming.t("payment.paymentMethods")}</th>
                      <th>{naming.t("home.total")}</th>
                      <th>{naming.t("sales.statusFilter")}</th>
                      <th>{naming.t("sales.actionsColumn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPage.content.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <strong>#{sale.saleNumber ?? sale.id}</strong>
                          <span>{sale.documentNumber || sale.registerCode || "PDV"}</span>
                        </td>
                        <td>
                          <strong>{sale.customerName || naming.t("payment.unidentifiedCustomer")}</strong>
                          <span>{sale.customerDocument || `ID ${sale.tutorId ?? "—"}`}</span>
                        </td>
                        <td>
                          <strong>{formatDateTime(sale.confirmedAt || sale.updatedAt)}</strong>
                          <span>{sale.status === "CANCELED" && sale.canceledAt ? formatDateTime(sale.canceledAt) : formatDateTime(sale.createdAt)}</span>
                        </td>
                        <td>
                          <strong>{sale.itemCount ?? 0}</strong>
                          <span>{naming.t("home.items")}</span>
                        </td>
                        <td>
                          <strong>{sale.paidTotal > 0 ? formatMoney(sale.paidTotal) : "—"}</strong>
                          <span>{sale.remaining > 0 ? `${naming.t("payment.pending")} ${formatMoney(sale.remaining)}` : naming.t("sales.settled")}</span>
                        </td>
                        <td>
                          <strong>{formatMoney(sale.total)}</strong>
                          <span>{sale.discount > 0 ? `${naming.t("sales.discountLabel")} ${formatMoney(sale.discount)}` : "—"}</span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${getStatusTone(sale.status)}`}>{getStatusLabel(naming, sale.status)}</span>
                        </td>
                        <td>
                          <button className={styles.iconButton} type="button" onClick={() => handleOpenDetails(sale.id)}>
                            <EyeIcon size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  disabled={page === 0}
                >
                  {naming.t("sales.previousPage")}
                </button>

                <div className={styles.paginationNumbers}>
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={pageNumber === page ? styles.pageButtonActive : styles.pageButton}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber + 1}
                    </button>
                  ))}
                </div>

                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setPage((current) => Math.min(current + 1, Math.max(salesPage.totalPages - 1, 0)))}
                  disabled={page >= salesPage.totalPages - 1}
                >
                  {naming.t("sales.nextPage")}
                </button>
              </div>
            </>
          )}
        </article>
      </section>

      {selectedSaleId ? (
        <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && handleCloseDetails()}>
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.kicker}>{naming.t("sales.detailTitle")}</div>
                <h2>
                  {selectedSale ? `${naming.t("payment.saleLabel")} #${selectedSale.summary.saleNumber ?? selectedSale.sale.id}` : naming.getMessage("loading")}
                </h2>
                <p>
                  {selectedSale
                    ? `${getCustomerLabel(selectedSale.receipt, selectedSale.summary)} • ${getReceiptDocument(selectedSale.receipt, selectedSale.sale, selectedSale.summary)}`
                    : naming.t("sales.detailDescription")}
                </p>
              </div>
              <button className={styles.iconButton} type="button" onClick={handleCloseDetails}>
                <XCircleIcon size={18} />
              </button>
            </div>

            {detailsLoading || !selectedSale ? (
              <div className={styles.modalState}>{naming.getMessage("loading")}</div>
            ) : (
              <>
                <div className={styles.modalBody}>
                  <div className={styles.summaryGrid}>
                    <div className={styles.metricCard}>
                      <span>{naming.t("sales.dateColumn")}</span>
                      <strong>{formatDateTime(selectedSale.sale.confirmedAt || selectedSale.sale.updatedAt)}</strong>
                    </div>
                    <div className={styles.metricCard}>
                      <span>{naming.t("sales.statusFilter")}</span>
                      <strong>{getStatusLabel(naming, selectedSale.sale.status)}</strong>
                    </div>
                    <div className={styles.metricCard}>
                      <span>{naming.t("home.total")}</span>
                      <strong>{formatMoney(selectedSale.sale.total)}</strong>
                    </div>
                    <div className={styles.metricCard}>
                      <span>{naming.t("payment.received")}</span>
                      <strong>{formatMoney(selectedSale.receipt?.receivedTotal ?? selectedSale.sale.paidTotal)}</strong>
                    </div>
                  </div>

                  <div className={styles.modalSection}>
                    <div className={styles.sectionHeader}>
                      <h3>{naming.t("payment.summary")}</h3>
                      <span className={styles.badge}>{selectedSale.sale.items.length} {naming.t("home.items").toLowerCase()}</span>
                    </div>
                    <div className={styles.detailList}>
                      {selectedSale.sale.items.map((item, index) => (
                        <div key={item.id} className={styles.detailRow}>
                          <div>
                            <strong>{index + 1}. {item.description}</strong>
                            <span>{item.quantity} {item.unit} x {formatMoney(item.unitPrice)}</span>
                          </div>
                          <b>{formatMoney(item.total)}</b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.modalSection}>
                    <div className={styles.sectionHeader}>
                      <h3>{naming.t("payment.paymentMethods")}</h3>
                      <span className={styles.badge}>{selectedSale.sale.payments.length}</span>
                    </div>
                    <div className={styles.detailList}>
                      {selectedSale.sale.payments.length > 0 ? (
                        selectedSale.sale.payments.map((payment) => (
                          <div key={payment.id} className={styles.detailRow}>
                            <div>
                              <strong>{methodLabel(naming, payment.method)}</strong>
                              <span>{payment.notes || formatDateTime(payment.paidAt || payment.createdAt)}</span>
                            </div>
                            <b>{formatMoney(payment.amount)}</b>
                          </div>
                        ))
                      ) : (
                        <div className={styles.inlineHint}>{naming.t("payment.noPaymentsYet")}</div>
                      )}
                    </div>
                  </div>

                  {selectedSale.receipt ? (
                    <div className={styles.totalsPanel}>
                      <div className={styles.totalRow}>
                        <span>{naming.t("home.subtotal")}</span>
                        <strong>{formatMoney(selectedSale.receipt.subtotal)}</strong>
                      </div>
                      <div className={styles.totalRow}>
                        <span>{naming.t("home.total")}</span>
                        <strong>{formatMoney(selectedSale.receipt.total)}</strong>
                      </div>
                      <div className={styles.totalRow}>
                        <span>{naming.t("payment.estimatedTaxes")}</span>
                        <strong>{formatMoney(selectedSale.receipt.estimatedTaxes.total)}</strong>
                      </div>
                      <div className={styles.totalRow}>
                        <span>{naming.t("payment.change")}</span>
                        <strong>{formatMoney(selectedSale.receipt.change)}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={styles.modalActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void handleDownloadXml()}
                    disabled={actionLoading !== null || selectedSale.summary.xmlAvailable === false}
                  >
                    <DownloadSimpleIcon size={18} />
                    <span>{naming.t("sales.downloadXml")}</span>
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void handlePrint()}
                    disabled={actionLoading !== null || !selectedSale.receipt}
                  >
                    <PrinterIcon size={18} />
                    <span>{naming.t("payment.reprintReceipt")}</span>
                  </button>
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => void handleCancelSale()}
                    disabled={actionLoading !== null || !canCancelSelectedSale}
                  >
                    <ReceiptIcon size={18} />
                    <span>{naming.t("payment.cancelSale")}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
