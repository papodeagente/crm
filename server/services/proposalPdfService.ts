/**
 * proposalPdfService — gera PDF visual da proposta com a marca do tenant.
 *
 * Layout:
 *   - Faixa de cor primária no topo
 *   - Logo + nome da empresa
 *   - Bloco "Proposta para" com snapshot do cliente (nome, email, doc, telefone)
 *   - Tabela de itens com bandeamento, coluna "Unidade", desconto por linha
 *   - Bloco de totais: subtotal, desconto, taxa, TOTAL em destaque
 *   - Notas livres
 *   - Validade (se houver)
 *   - Bloco de pagamento com link Asaas
 *   - Rodapé com endereço, telefone, website, footer text do branding
 */

import PDFDocument from "pdfkit";
import * as crm from "../crmDb";

const MUTED = "#64748B";
const SUBTLE = "#94A3B8";
const BORDER = "#E5E7EB";
const ROW_ALT = "#F8FAFC";
const TEXT = "#0F172A";

function brl(cents: number | null | undefined, currency = "BRL"): string {
  const v = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

function decodeDataUrl(input?: string | null): Buffer | null {
  if (!input) return null;
  const m = input.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  try {
    return Buffer.from(m[2], "base64");
  } catch {
    return null;
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDocId(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return raw;
}

export interface ProposalPdfData {
  buffer: Buffer;
  fileName: string;
}

export async function generateProposalPdf(tenantId: number, proposalId: number): Promise<ProposalPdfData> {
  const proposal = await crm.getProposalById(tenantId, proposalId);
  if (!proposal) throw new Error("Proposta não encontrada");

  const [branding, items, deal] = await Promise.all([
    crm.getTenantBranding(tenantId),
    crm.listProposalItems(tenantId, proposalId),
    crm.getDealById(tenantId, proposal.dealId),
  ]);

  // Prefer client snapshot (frozen at sent-time) over current contact data
  const snapshot = (proposal.clientSnapshotJson as any) || null;
  const contact = !snapshot && deal?.contactId
    ? await crm.getContactById(tenantId, deal.contactId)
    : null;

  const clientName = snapshot?.name || contact?.name || "—";
  const clientEmail = snapshot?.email || contact?.email || null;
  const clientPhone = snapshot?.phone || contact?.phoneE164 || contact?.phone || null;
  const clientDoc = snapshot?.docId || contact?.docId || null;

  const clinicName = branding?.name || "Empresa";
  const primary = branding?.primaryColor || "#5A8A1F";
  const accent = branding?.accentColor || "#0A0A0A";
  const logoBuffer = decodeDataUrl(branding?.logoUrl ?? null);

  const doc = new PDFDocument({
    size: "A4",
    margin: 0, // controlamos margens manualmente
    info: { Title: `Proposta #${proposal.id} — ${clinicName}`, Author: clinicName },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // Page constants
  const PAGE_W = doc.page.width;          // 595 (A4)
  const PAGE_H = doc.page.height;         // 842
  const MARGIN_X = 48;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  // Faixa de cor primária no topo (banner)
  doc.fillColor(primary).rect(0, 0, PAGE_W, 6).fill();

  // ── Header ──
  let y = 32;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGIN_X, y, { fit: [70, 50] });
    } catch { /* ignore bad images */ }
  }
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(18)
    .text(clinicName, MARGIN_X + (logoBuffer ? 84 : 0), y + 4, { width: CONTENT_W - 84, ellipsis: true });
  doc.fillColor(MUTED).font("Helvetica").fontSize(10)
    .text("Proposta comercial", MARGIN_X + (logoBuffer ? 84 : 0), y + 28);

  // Right side: proposal id + date
  const issued = formatDate(proposal.createdAt);
  doc.fillColor(SUBTLE).fontSize(9).text("PROPOSTA", PAGE_W - MARGIN_X - 120, y + 2, { width: 120, align: "right" });
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(14).text(`#${proposal.id}`, PAGE_W - MARGIN_X - 120, y + 14, { width: 120, align: "right" });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Emitida em ${issued}`, PAGE_W - MARGIN_X - 120, y + 32, { width: 120, align: "right" });

  y += 76;
  // Linha divisória sutil
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN_X, y).lineTo(PAGE_W - MARGIN_X, y).stroke();
  y += 22;

  // ── "Proposta para" ──
  doc.fillColor(SUBTLE).font("Helvetica-Bold").fontSize(8).text("PROPOSTA PARA", MARGIN_X, y);
  y += 12;
  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(13).text(clientName, MARGIN_X, y);
  y += 18;

  const detailLines: string[] = [];
  if (clientEmail) detailLines.push(clientEmail);
  if (clientPhone) detailLines.push(clientPhone);
  if (clientDoc) detailLines.push(`CPF/CNPJ: ${formatDocId(clientDoc)}`);
  if (detailLines.length > 0) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(detailLines.join("  ·  "), MARGIN_X, y, { width: CONTENT_W });
    y += 14;
  }

  if (proposal.validUntil) {
    doc.fillColor(SUBTLE).font("Helvetica").fontSize(9)
      .text(`Validade: ${formatDate(proposal.validUntil)}`, MARGIN_X, y);
    y += 14;
  }

  y += 14;

  // ── Tabela de Itens ──
  doc.fillColor(SUBTLE).font("Helvetica-Bold").fontSize(8).text("ITENS DA PROPOSTA", MARGIN_X, y);
  y += 16;

  // Layout colunas
  const colDesc = MARGIN_X;
  const descW = 230;
  const colQty = colDesc + descW + 8;
  const qtyW = 38;
  const colUnit = colQty + qtyW + 8;
  const unitW = 50;
  const colPrice = colUnit + unitW + 8;
  const priceW = 80;
  const colTotal = colPrice + priceW + 8;
  const totalW = PAGE_W - MARGIN_X - colTotal;

  // Header row
  doc.fillColor(primary).rect(MARGIN_X, y, CONTENT_W, 22).fill();
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  doc.text("Descrição", colDesc + 8, y + 7, { width: descW - 8 });
  doc.text("Qtd", colQty, y + 7, { width: qtyW, align: "right" });
  doc.text("Unid.", colUnit, y + 7, { width: unitW });
  doc.text("Preço un.", colPrice, y + 7, { width: priceW, align: "right" });
  doc.text("Total", colTotal, y + 7, { width: totalW - 8, align: "right" });
  y += 22;

  function addPageIfNeeded(neededHeight: number) {
    if (y + neededHeight > PAGE_H - 100) {
      doc.addPage();
      doc.fillColor(primary).rect(0, 0, PAGE_W, 6).fill();
      y = 48;
    }
  }

  // Body rows
  if (items.length === 0) {
    addPageIfNeeded(40);
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(10)
      .text("Nenhum item adicionado à proposta.", colDesc + 8, y + 12);
    y += 32;
  } else {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] as any;
      const title = it.title || "—";
      const desc = it.description || "";
      const qty = Number(it.qty ?? 1);
      const unit = it.unit || "un";
      const unitPrice = Number(it.unitPriceCents ?? 0);
      const lineTotal = Number(it.totalCents ?? qty * unitPrice);

      // Compute row height
      doc.font("Helvetica").fontSize(10);
      const titleH = doc.heightOfString(title, { width: descW - 8 });
      doc.font("Helvetica").fontSize(8.5);
      const descH = desc ? doc.heightOfString(desc, { width: descW - 8 }) : 0;
      const rowH = Math.max(28, titleH + descH + 14);

      addPageIfNeeded(rowH);

      // Banding
      if (i % 2 === 1) {
        doc.fillColor(ROW_ALT).rect(MARGIN_X, y, CONTENT_W, rowH).fill();
      }

      doc.fillColor(TEXT).font("Helvetica").fontSize(10).text(title, colDesc + 8, y + 7, { width: descW - 8 });
      if (desc) {
        doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(desc, colDesc + 8, y + 7 + titleH + 2, { width: descW - 8 });
      }
      doc.fillColor(TEXT).font("Helvetica").fontSize(10).text(String(qty), colQty, y + 7, { width: qtyW, align: "right" });
      doc.fillColor(MUTED).fontSize(9.5).text(unit, colUnit, y + 7, { width: unitW });
      doc.fillColor(TEXT).fontSize(10).text(brl(unitPrice), colPrice, y + 7, { width: priceW, align: "right" });
      doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(10).text(brl(lineTotal), colTotal, y + 7, { width: totalW - 8, align: "right" });

      y += rowH;
      doc.strokeColor(BORDER).lineWidth(0.3).moveTo(MARGIN_X, y).lineTo(PAGE_W - MARGIN_X, y).stroke();
    }
  }

  // ── Totais ──
  y += 14;
  addPageIfNeeded(120);
  const totalsLabelX = colPrice;
  const totalsValueX = colTotal;

  function totalRow(label: string, value: string, opts: { bold?: boolean; primary?: boolean; size?: number } = {}) {
    const fontSize = opts.size ?? 10;
    const labelColor = opts.primary ? primary : MUTED;
    const valueColor = opts.primary ? primary : TEXT;
    doc.fillColor(labelColor).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize)
      .text(label, totalsLabelX, y, { width: priceW, align: "right" });
    doc.fillColor(valueColor).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize)
      .text(value, totalsValueX, y, { width: totalW - 8, align: "right" });
    y += fontSize + 6;
  }

  const subtotal = Number(proposal.subtotalCents ?? items.reduce((acc, i: any) => acc + Number(i.totalCents ?? 0), 0));
  const discount = Number(proposal.discountCents ?? 0);
  const tax = Number(proposal.taxCents ?? 0);

  if (subtotal !== Number(proposal.totalCents ?? 0)) {
    totalRow("Subtotal", brl(subtotal));
    if (discount > 0) totalRow("Desconto", `-${brl(discount)}`);
    if (tax > 0) totalRow("Impostos / taxas", `+${brl(tax)}`);
    y += 4;
  }
  // Linha de destaque para o total
  doc.strokeColor(primary).lineWidth(2).moveTo(totalsLabelX, y).lineTo(PAGE_W - MARGIN_X, y).stroke();
  y += 8;
  totalRow("TOTAL", brl(proposal.totalCents, proposal.currency || "BRL"), { bold: true, primary: true, size: 14 });

  // ── Notas ──
  if (proposal.notes && proposal.notes.trim()) {
    y += 24;
    addPageIfNeeded(80);
    doc.fillColor(SUBTLE).font("Helvetica-Bold").fontSize(8).text("OBSERVAÇÕES", MARGIN_X, y);
    y += 12;
    doc.fillColor(TEXT).font("Helvetica").fontSize(10).text(proposal.notes, MARGIN_X, y, { width: CONTENT_W });
    y += doc.heightOfString(proposal.notes, { width: CONTENT_W }) + 4;
  }

  // ── Pagamento ──
  if (proposal.asaasInvoiceUrl) {
    y += 24;
    addPageIfNeeded(80);
    doc.fillColor(primary).rect(MARGIN_X, y, CONTENT_W, 4).fill();
    y += 16;
    doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(11).text("Pagamento", MARGIN_X, y);
    y += 16;
    doc.fillColor(MUTED).font("Helvetica").fontSize(10)
      .text("Acesse o link abaixo para realizar o pagamento (PIX, Boleto ou Cartão):", MARGIN_X, y, { width: CONTENT_W });
    y += 18;
    doc.fillColor(primary).font("Helvetica-Bold").fontSize(10)
      .text(proposal.asaasInvoiceUrl, MARGIN_X, y, {
        width: CONTENT_W,
        link: proposal.asaasInvoiceUrl,
        underline: true,
      });
  }

  // ── Footer ──
  const footerY = PAGE_H - 60;
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN_X, footerY).lineTo(PAGE_W - MARGIN_X, footerY).stroke();

  const footerLines: string[] = [];
  if (branding?.address) footerLines.push(branding.address);
  if (branding?.phone) footerLines.push(branding.phone);
  if (branding?.website) footerLines.push(branding.website);
  if (branding?.footerText) footerLines.push(branding.footerText);

  doc.fillColor(SUBTLE).font("Helvetica").fontSize(8)
    .text(footerLines.join("  ·  ") || `${clinicName} · Proposta #${proposal.id}`, MARGIN_X, footerY + 10, {
      width: CONTENT_W,
      align: "center",
    });
  doc.fillColor(SUBTLE).fontSize(7.5)
    .text(`Proposta #${proposal.id} · gerada em ${formatDate(new Date())}`, MARGIN_X, footerY + 26, {
      width: CONTENT_W,
      align: "center",
    });

  doc.end();
  await done;
  return { buffer: Buffer.concat(chunks), fileName: `proposta-${proposal.id}.pdf` };
}
