import type { SaleReceiptResponse } from "../../services/api/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type ReceiptPrintNaming = {
  t: (key: string) => string;
};

export function openReceiptPrintPreview(
  targetReceipt: SaleReceiptResponse,
  naming: ReceiptPrintNaming,
  methodLabel: (method: SaleReceiptResponse["payments"][number]["method"]) => string,
  onBlocked?: () => void
) {
  const popup = window.open("", "_blank", "width=460,height=760");
  if (!popup) {
    onBlocked?.();
    return;
  }

  const itemsHtml = targetReceipt.items
    .map(
      (item) => `
        <tr>
          <td>${item.lineNumber}</td>
          <td>${escapeHtml(item.description)}</td>
          <td style="text-align:right">${escapeHtml(String(item.quantity))}</td>
          <td style="text-align:right">${escapeHtml(formatMoney(item.total))}</td>
        </tr>
      `
    )
    .join("");

  const paymentsHtml = targetReceipt.payments
    .map(
      (payment) => `
        <tr>
          <td>${escapeHtml(methodLabel(payment.method))}</td>
          <td style="text-align:right">${escapeHtml(formatMoney(payment.amount))}</td>
        </tr>
      `
    )
    .join("");

  popup.document.write(`
    <html lang="pt-BR">
      <head>
        <title>${escapeHtml(targetReceipt.documentLabel)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #10151f; }
          .sheet { max-width: 360px; margin: 0 auto; }
          .notice { margin: 16px 0; padding: 10px 12px; border: 1px dashed #d97706; background: #fff7ed; color: #9a3412; font-size: 12px; }
          h1, h2, p { margin: 0; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          h2 { font-size: 13px; margin-top: 18px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .08em; }
          .muted { color: #556070; font-size: 12px; }
          .totals, table { width: 100%; border-collapse: collapse; }
          td { padding: 5px 0; font-size: 13px; vertical-align: top; }
          .rule { border-top: 1px dashed #a7afb9; margin: 14px 0; }
          .strong { font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <h1>${escapeHtml(targetReceipt.company.displayName)}</h1>
          <p class="muted">${escapeHtml(targetReceipt.company.legalName)}</p>
          <p class="muted">CNPJ ${escapeHtml(targetReceipt.company.cnpj ?? "—")}</p>
          <div class="notice">${escapeHtml(targetReceipt.notice)}</div>
          <p class="muted">${escapeHtml(targetReceipt.documentLabel)} ${escapeHtml(targetReceipt.documentNumber)} série ${escapeHtml(targetReceipt.series)}</p>
          <p class="muted">${escapeHtml(formatDateTime(targetReceipt.issuedAt))} • ${escapeHtml(targetReceipt.registerCode)}</p>
          <div class="rule"></div>
          <h2>${escapeHtml(naming.t("payment.consumer"))}</h2>
          <p>${escapeHtml(targetReceipt.customer.name)}</p>
          <p class="muted">${escapeHtml(targetReceipt.customer.document ?? "Sem documento")}</p>
          <div class="rule"></div>
          <h2>${escapeHtml(naming.t("payment.summary"))}</h2>
          <table>${itemsHtml}</table>
          <div class="rule"></div>
          <table class="totals">
            <tr><td>${escapeHtml(naming.t("home.subtotal"))}</td><td style="text-align:right">${escapeHtml(formatMoney(targetReceipt.subtotal))}</td></tr>
            <tr><td>${escapeHtml(naming.t("home.total"))}</td><td style="text-align:right" class="strong">${escapeHtml(formatMoney(targetReceipt.total))}</td></tr>
            <tr><td>${escapeHtml(naming.t("payment.estimatedTaxes"))}</td><td style="text-align:right">${escapeHtml(formatMoney(targetReceipt.estimatedTaxes.total))}</td></tr>
            <tr><td>${escapeHtml(naming.t("payment.received"))}</td><td style="text-align:right">${escapeHtml(formatMoney(targetReceipt.receivedTotal))}</td></tr>
            <tr><td>${escapeHtml(naming.t("payment.change"))}</td><td style="text-align:right">${escapeHtml(formatMoney(targetReceipt.change))}</td></tr>
          </table>
          <div class="rule"></div>
          <p class="muted">${escapeHtml(naming.t("payment.federalTaxes"))}: ${escapeHtml(formatMoney(targetReceipt.estimatedTaxes.federal))}</p>
          <p class="muted">${escapeHtml(naming.t("payment.stateTaxes"))}: ${escapeHtml(formatMoney(targetReceipt.estimatedTaxes.state))}</p>
          <p class="muted">${escapeHtml(naming.t("payment.municipalTaxes"))}: ${escapeHtml(formatMoney(targetReceipt.estimatedTaxes.municipal))}</p>
          <div class="rule"></div>
          <h2>${escapeHtml(naming.t("payment.paymentMethods"))}</h2>
          <table>${paymentsHtml}</table>
          <div class="rule"></div>
          <p class="muted">${escapeHtml(naming.t("payment.receiptKey"))}: ${escapeHtml(targetReceipt.accessKey)}</p>
          <p class="muted">${escapeHtml(naming.t("payment.receiptProtocol"))}: ${escapeHtml(targetReceipt.protocol)}</p>
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  popup.document.close();
}
