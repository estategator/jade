import 'server-only';

import type { AgreementType } from '@/lib/agreement-types';
import { escapeHtml } from '@/lib/email/shared/escape-html';

export type ContractDocumentAdditionalCharge = {
  label: string;
  amount: number;
};

export type ContractDocumentDiscountDay = {
  day: number;
  percent: number;
};

export type ContractDocumentUnsoldHandling = 'client_keeps' | 'donate' | 'haul_away' | 'negotiate';

export type ContractSendDocument = {
  name: string;
  fileExtension: 'html' | 'pdf';
  contentBase64: string;
};

export type ContractDocumentRenderInput = {
  agreementType: AgreementType;
  documentTitle: string;
  orgName: string;
  projectName: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string | null;
  signerAddress?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  terms: {
    commissionRate: number | null;
    minimumCommission: number | null;
    flatFee: number | null;
    additionalCharges: ContractDocumentAdditionalCharge[];
    saleDurationDays: number | null;
    discountSchedule: ContractDocumentDiscountDay[];
    unsoldItemsHandling: ContractDocumentUnsoldHandling;
    paymentTermsDays: number | null;
    cancellationFee: number | null;
    specialTerms: string;
  };
};

export const CONTRACT_SIGN_HERE_ANCHOR = '/curator_sign_here/';
export const CONTRACT_SIGN_DATE_ANCHOR = '/curator_sign_date/';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const agreementTypeLabels: Record<AgreementType, string> = {
  estate_sale: 'Estate Sale Agreement',
  buyout: 'Buy Out Agreement',
};

const unsoldHandlingLabels: Record<ContractDocumentUnsoldHandling, string> = {
  client_keeps: 'Client keeps remaining items',
  donate: 'Donate remaining items',
  haul_away: 'Haul away or dispose remaining items',
  negotiate: 'Negotiate next steps after the sale',
};

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'Not specified';
  }

  return currencyFormatter.format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'Not specified';
  }

  return `${formatNumber(value)}%`;
}

function formatDays(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'Not specified';
  }

  return `${formatNumber(value)} day${value === 1 ? '' : 's'}`;
}

function formatPlainText(value: string | null | undefined, fallback = 'Not provided'): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : fallback;
}

function formatMultilineText(value: string): string {
  const trimmed = value.trim();
  return trimmed ? escapeHtml(trimmed).replace(/\r?\n/g, '<br>') : 'No additional terms provided.';
}

function formatAddress(input: ContractDocumentRenderInput['signerAddress']): string {
  if (!input) {
    return 'Not provided';
  }

  const locality = [input.city?.trim(), input.state?.trim(), input.zipCode?.trim()]
    .filter(Boolean)
    .join(', ');

  const lines = [
    input.addressLine1?.trim(),
    input.addressLine2?.trim(),
    locality || null,
  ].filter((line): line is string => Boolean(line));

  if (lines.length === 0) {
    return 'Not provided';
  }

  return lines.map((line) => escapeHtml(line)).join('<br>');
}

function renderDefinitionRows(rows: Array<{ label: string; value: string }>): string {
  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #d6d3d1;font-size:13px;font-weight:600;color:#44403c;width:36%;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #d6d3d1;font-size:14px;color:#1c1917;vertical-align:top;">${row.value}</td>
        </tr>`,
    )
    .join('');
}

function renderAdditionalCharges(charges: ContractDocumentAdditionalCharge[]): string {
  if (charges.length === 0) {
    return '<p style="margin:0;color:#57534e;font-size:14px;">No additional charges specified.</p>';
  }

  return `
    <ul style="margin:0;padding-left:20px;color:#1c1917;font-size:14px;line-height:1.6;">
      ${charges
        .map(
          (charge) => `<li><strong>${escapeHtml(charge.label)}</strong>: ${escapeHtml(formatCurrency(charge.amount))}</li>`,
        )
        .join('')}
    </ul>`;
}

function renderDiscountSchedule(discountSchedule: ContractDocumentDiscountDay[]): string {
  if (discountSchedule.length === 0) {
    return '<p style="margin:0;color:#57534e;font-size:14px;">No scheduled markdowns specified.</p>';
  }

  return `
    <ul style="margin:0;padding-left:20px;color:#1c1917;font-size:14px;line-height:1.6;">
      ${discountSchedule
        .map(
          (discount) => `<li>Day ${escapeHtml(formatNumber(discount.day))}: ${escapeHtml(formatNumber(discount.percent))}% discount</li>`,
        )
        .join('')}
    </ul>`;
}

export function buildContractHtmlDocument(input: ContractDocumentRenderInput): ContractSendDocument {
  const preparedOn = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const agreementLabel = agreementTypeLabels[input.agreementType];
  const metadataRows = renderDefinitionRows([
    { label: 'Agreement type', value: escapeHtml(agreementLabel) },
    { label: 'Organization', value: escapeHtml(input.orgName) },
    { label: 'Project', value: escapeHtml(input.projectName) },
    { label: 'Prepared on', value: escapeHtml(preparedOn) },
    { label: 'Client', value: escapeHtml(input.signerName) },
    { label: 'Client email', value: escapeHtml(input.signerEmail) },
    { label: 'Client phone', value: formatPlainText(input.signerPhone) },
    { label: 'Client address', value: formatAddress(input.signerAddress) },
  ]);

  const commercialRows = renderDefinitionRows([
    { label: 'Commission rate', value: escapeHtml(formatPercent(input.terms.commissionRate)) },
    { label: 'Minimum commission', value: escapeHtml(formatCurrency(input.terms.minimumCommission)) },
    { label: 'Flat fee', value: escapeHtml(formatCurrency(input.terms.flatFee)) },
    { label: 'Sale duration', value: escapeHtml(formatDays(input.terms.saleDurationDays)) },
    { label: 'Payment terms', value: escapeHtml(formatDays(input.terms.paymentTermsDays)) },
    { label: 'Cancellation fee', value: escapeHtml(formatCurrency(input.terms.cancellationFee)) },
    { label: 'Unsold items', value: escapeHtml(unsoldHandlingLabels[input.terms.unsoldItemsHandling]) },
  ]);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.documentTitle)}</title>
  </head>
  <body style="margin:0;background:#f5f5f4;color:#1c1917;font-family:Georgia, 'Times New Roman', serif;">
    <div style="max-width:860px;margin:0 auto;padding:32px 24px 48px;">
      <div style="background:#ffffff;border:1px solid #d6d3d1;border-radius:18px;overflow:hidden;box-shadow:0 18px 60px rgba(28, 25, 23, 0.08);">
        <div style="padding:32px;border-bottom:1px solid #e7e5e4;background:linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%);">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#57534e;">Curator agreement</p>
          <h1 style="margin:0;font-size:32px;line-height:1.15;color:#1c1917;">${escapeHtml(input.documentTitle)}</h1>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#44403c;">This ${escapeHtml(agreementLabel.toLowerCase())} is prepared for ${escapeHtml(input.signerName)} and covers the services for ${escapeHtml(input.projectName)} with ${escapeHtml(input.orgName)}.</p>
        </div>

        <div style="padding:32px;">
          <section style="margin-bottom:28px;">
            <h2 style="margin:0 0 14px;font-size:18px;color:#1c1917;">Agreement summary</h2>
            <table style="width:100%;border-collapse:collapse;border:1px solid #d6d3d1;border-radius:14px;overflow:hidden;">${metadataRows}
            </table>
          </section>

          <section style="margin-bottom:28px;">
            <h2 style="margin:0 0 14px;font-size:18px;color:#1c1917;">Commercial terms</h2>
            <table style="width:100%;border-collapse:collapse;border:1px solid #d6d3d1;border-radius:14px;overflow:hidden;">${commercialRows}
            </table>
          </section>

          <section style="margin-bottom:28px;">
            <h2 style="margin:0 0 10px;font-size:18px;color:#1c1917;">Additional charges</h2>
            ${renderAdditionalCharges(input.terms.additionalCharges)}
          </section>

          <section style="margin-bottom:28px;">
            <h2 style="margin:0 0 10px;font-size:18px;color:#1c1917;">Discount schedule</h2>
            ${renderDiscountSchedule(input.terms.discountSchedule)}
          </section>

          <section style="margin-bottom:32px;">
            <h2 style="margin:0 0 10px;font-size:18px;color:#1c1917;">Special terms</h2>
            <div style="border:1px solid #d6d3d1;border-radius:14px;padding:16px;background:#fafaf9;font-size:14px;line-height:1.7;color:#1c1917;">
              ${formatMultilineText(input.terms.specialTerms)}
            </div>
          </section>

          <section>
            <h2 style="margin:0 0 12px;font-size:18px;color:#1c1917;">Signature</h2>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#44403c;">By signing below, the client acknowledges and accepts the agreement terms summarized in this document.</p>
            <table style="width:100%;border-collapse:separate;border-spacing:0 14px;">
              <tr>
                <td style="width:70%;padding-right:18px;vertical-align:bottom;">
                  <div style="height:58px;border-bottom:1px solid #1c1917;display:flex;align-items:flex-end;padding-bottom:8px;">
                    <span style="font-size:1px;line-height:1;color:#ffffff;">${CONTRACT_SIGN_HERE_ANCHOR}</span>
                  </div>
                  <div style="padding-top:8px;font-size:12px;color:#57534e;">Client signature</div>
                </td>
                <td style="width:30%;vertical-align:bottom;">
                  <div style="height:58px;border-bottom:1px solid #1c1917;display:flex;align-items:flex-end;padding-bottom:8px;">
                    <span style="font-size:1px;line-height:1;color:#ffffff;">${CONTRACT_SIGN_DATE_ANCHOR}</span>
                  </div>
                  <div style="padding-top:8px;font-size:12px;color:#57534e;">Date signed</div>
                </td>
              </tr>
              <tr>
                <td style="padding-right:18px;font-size:13px;color:#44403c;">${escapeHtml(input.signerName)}</td>
                <td style="font-size:13px;color:#44403c;">${escapeHtml(input.projectName)}</td>
              </tr>
            </table>
          </section>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return {
    name: input.documentTitle,
    fileExtension: 'html',
    contentBase64: Buffer.from(html, 'utf8').toString('base64'),
  };
}