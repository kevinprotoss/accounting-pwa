import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { db, dataDir } from '../db.js';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ['--no-sandbox'] });
  }
  try {
    const browser = await browserPromise;
    if (!browser.isConnected()) {
      browserPromise = chromium.launch({ args: ['--no-sandbox'] });
      return browserPromise;
    }
    return browser;
  } catch {
    browserPromise = chromium.launch({ args: ['--no-sandbox'] });
    return browserPromise;
  }
}

function money(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildInvoiceHtml(issue, company) {
  const isExport = issue.is_export === 1;

  const rows = issue.items
    .map((it, idx) => {
      const net = Number(it.selling_net_price) || 0;
      const qty = Number(it.quantity) || 0;
      const rate = isExport ? 0 : Number(it.tax_rate) || 0;
      const gross = net * qty * (1 + rate / 100);
      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${escapeHtml(it.product_name ?? '')}</td>
          <td class="num">${money(net)} €</td>
          <td class="center">${qty}</td>
          <td class="num">${money(gross)} €</td>
        </tr>`;
    })
    .join('');

  const netTotal = issue.items.reduce(
    (s, it) => s + (Number(it.selling_net_price) || 0) * (Number(it.quantity) || 0),
    0
  );
  const taxTotal = isExport
    ? 0
    : issue.items.reduce((s, it) => {
        const net = Number(it.selling_net_price) || 0;
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.tax_rate) || 0;
        return s + (net * qty * rate) / 100;
      }, 0);
  const grossTotal = netTotal + taxTotal;

  const paymentDeadline = addDays(issue.date, 14);
  const serviceDate = issue.shipping_date || issue.date;

  const customerBlock = [
    issue.customer_name,
    ...(issue.customer_address ? issue.customer_address.split('\n') : []),
    issue.customer_vat_id ? `USt-IdNr.: ${issue.customer_vat_id}` : '',
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join('<br>');

  const companyBlock = [company.name, company.street, company.city]
    .filter(Boolean)
    .map(escapeHtml)
    .join('<br>');

  const vatLine = isExport
    ? `<p>zzgl. MwSt.: <strong>0,00 €</strong> (steuerfreie Ausfuhrlieferung gem. §4 Nr.1b UStG)</p>`
    : `<p>zzgl. 19% MwSt.: <strong>${money(taxTotal)} €</strong></p>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #000; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm; }
  .top { display: flex; justify-content: space-between; margin-bottom: 12mm; }
  .company { text-align: right; line-height: 1.5; font-size: 10px; }
  .customer { line-height: 1.5; font-size: 10px; }
  h1 { font-size: 22px; text-align: center; margin: 6mm 0 8mm 0; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 6mm; padding-bottom: 3mm; border-bottom: 1px solid #ccc; }
  .thanks { font-size: 11px; margin-bottom: 5mm; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 5mm; }
  th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  th { background: #f1f3f5; font-weight: bold; text-align: center; }
  .num { text-align: right; }
  .center { text-align: center; }
  .amounts { text-align: right; font-size: 11px; line-height: 1.7; margin-bottom: 8mm; }
  .amounts p { margin: 2px 0; }
  .amounts .total { font-weight: bold; font-size: 12px; margin-top: 4px; }
  .payment { font-size: 10px; line-height: 1.5; margin-bottom: 4mm; }
  .service-date { font-size: 10px; margin-bottom: 10mm; }
  .agb { font-size: 9px; color: #6c757d; line-height: 1.5; margin-bottom: 12mm; }
  .footer { display: flex; justify-content: space-between; font-size: 9px; line-height: 1.5; border-top: 1px solid #ccc; padding-top: 4mm; }
  .footer > div { flex: 1; }
  .footer > div:nth-child(2) { text-align: left; padding-left: 6mm; }
  .footer > div:nth-child(3) { text-align: left; }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div class="customer">${customerBlock}</div>
    <div class="company">${companyBlock}</div>
  </div>

  <h1>Rechnung</h1>

  <div class="meta">
    <span><strong>Rechnung Nr.</strong> ${escapeHtml(issue.invoice_number ?? '')}</span>
    <span><strong>Kunde Nr.</strong> ${issue.customer_id ?? ''}</span>
    <span><strong>Datum:</strong> ${fmtDate(issue.date)}</span>
  </div>

  <div class="thanks">
    vielen Dank für Ihren Auftrag. Vereinbarungsgemäß berechnen wir Ihnen hiermit folgende Leistungen:
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:8%">Pos</th>
        <th>Beschreibung</th>
        <th style="width:15%">Einzelpreis (€)</th>
        <th style="width:10%">Anzahl</th>
        <th style="width:15%">Gesamtpreis (€)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="amounts">
    <p>Nettobetrag: <strong>${money(netTotal)} €</strong></p>
    ${vatLine}
    <p class="total">Gesamtbetrag: <strong>${money(grossTotal)} €</strong></p>
  </div>

  <div class="payment">
    <p>Der Gesamtbetrag ist bis zum ${fmtDate(paymentDeadline)} auf unser unten genanntes Konto zu zahlen.</p>
  </div>

  <div class="service-date">
    <strong>Leistungsdatum:</strong> ${fmtDate(serviceDate)}
  </div>

  <div class="agb">
    Die aufgeführten Dienstleistungen haben Sie gemäß unserer AGB erhalten. Wenn nicht anders angegeben entspricht das Leistungsdatum dem Rechnungsdatum. Für weitere Fragen stehen wir Ihnen sehr gerne zur Verfügung.
  </div>

  <div class="footer">
    <div>
      ${escapeHtml(company.name ?? '')}<br>
      ${escapeHtml(company.street ?? '')}<br>
      ${escapeHtml(company.city ?? '')}
    </div>
    <div>
      Steuernummer: ${escapeHtml(company.tax_number ?? '')}<br>
      USt-IdNr.: ${escapeHtml(company.ust_idnr ?? '')}
    </div>
    <div>
      ${escapeHtml(company.bank_name ?? '')}<br>
      IBAN: ${escapeHtml(company.iban ?? '')}<br>
      BIC: ${escapeHtml(company.bic ?? '')}
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function generateAndSaveInvoicePdf(issueId) {
  const issue = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(issueId);
  if (!issue) throw new Error('Issue not found');

  const items = db
    .prepare(
      `SELECT gi.*, ri.product_name
       FROM goods_issue_items gi
       JOIN goods_receipt_items ri ON ri.id = gi.receipt_item_id
       WHERE gi.issue_id = ?
       ORDER BY gi.id`
    )
    .all(issueId);

  const company = db.prepare('SELECT * FROM company_info WHERE id = 1').get() ?? {};

  const isExport = issue.is_export === 1;
  const netTotal = items.reduce(
    (s, it) => s + (Number(it.selling_net_price) || 0) * (Number(it.quantity) || 0),
    0
  );
  const taxTotal = isExport
    ? 0
    : items.reduce((s, it) => {
        const net = Number(it.selling_net_price) || 0;
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.tax_rate) || 0;
        return s + (net * qty * rate) / 100;
      }, 0);
  const grossTotal = netTotal + taxTotal;

  const html = buildInvoiceHtml({ ...issue, items }, company);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const invoicesDir = path.join(dataDir, 'invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    const filePath = path.join(invoicesDir, `${issue.invoice_number}.pdf`);
    await fs.promises.writeFile(filePath, pdf);

    db.prepare(
      `INSERT OR IGNORE INTO invoices (invoice_number, issue_id, pdf_path)
       VALUES (?, ?, NULL)`
    ).run(issue.invoice_number, issueId);
    db.prepare(
      `UPDATE invoices SET pdf_path = ?, net_total = ?, tax_total = ?, gross_total = ?
       WHERE issue_id = ?`
    ).run(filePath, netTotal, taxTotal, grossTotal, issueId);

    return filePath;
  } finally {
    await page.close();
  }
}