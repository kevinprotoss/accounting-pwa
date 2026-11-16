function parseTaxRate(value) {
    if (value == null) return null;
    const m = String(value).match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    return Math.round(parseFloat(m[1]));
  }
  
  function parseMoney(value) {
    if (value == null) return null;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  
  function generateReceiptNumber() {
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const base =
      `RE-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-` +
      `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${base}-${rand}`;
  }
  
  function mapLineItems(invoice) {
    const items = invoice.line_items || [];
    const defaultRate = parseTaxRate(invoice.amounts?.tax_breakdown?.[0]?.tax_rate);
  
    return items
      .map((li) => {
        const desc = (li.description || '').trim();
        if (!desc) return null;
        const qty = parseFloat(li.quantity) || 1;
        let netUnit = parseMoney(li.unit_price);
        if (netUnit == null) {
          const netAmount = parseMoney(li.net_amount);
          if (netAmount != null && qty > 0) netUnit = netAmount / qty;
        }
        if (netUnit == null) netUnit = 0;
        const rate = parseTaxRate(li.tax_rate) ?? defaultRate ?? 19;
        return {
          product_name: desc,
          quantity: qty,
          net_unit_price: Math.round(netUnit * 100) / 100,
          tax_rate: rate,
        };
      })
      .filter(Boolean);
  }
  
  export function invoiceToReceipt(invoice, imagePaths) {
    const items = mapLineItems(invoice);
    return {
      receipt_number: generateReceiptNumber(),
      date:
        invoice.invoice?.invoice_date || new Date().toISOString().slice(0, 10),
      supplier: invoice.supplier?.name || null,
      supplier_invoice: invoice.invoice?.invoice_number || null,
      remarks: null,
      attachment_path: imagePaths.length > 0 ? JSON.stringify(imagePaths) : null,
      items,
    };
  }
  
  export function invoiceToExpense(invoice, imagePaths) {
    const rate = parseTaxRate(invoice.amounts?.tax_breakdown?.[0]?.tax_rate) ?? 19;
    return {
      date:
        invoice.invoice?.invoice_date || new Date().toISOString().slice(0, 10),
      category: '其他',
      description: invoice.supplier?.name || null,
      net_amount: parseMoney(invoice.amounts?.net_amount) ?? 0,
      tax_rate: rate,
      input_tax: parseMoney(invoice.amounts?.tax_amount) ?? 0,
      is_output_tax: 0,
      attachment_path: imagePaths.length > 0 ? JSON.stringify(imagePaths) : null,
      supplier_invoice: invoice.invoice?.invoice_number || null,
      remarks: null,
    };
  }