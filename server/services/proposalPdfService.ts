import PDFDocument from "pdfkit";
import * as crm from "../crmDb";
import { getDb } from "../db";
import { tenants } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const NAVY = "#0F172A";
const LIME = "#65A30D";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

function brl(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
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

async function loadTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return rows[0] || null;
}

export interface ProposalPdfData {
  buffer: Buffer;
  fileName: string;
}

export async function generateProposalPdf(tenantId: number, proposalId: number): Promise<ProposalPdfData> {
  const proposal = await crm.getProposalById(tenantId, proposalId);
  if (!proposal) throw new Error("Proposta não encontrada");

  const [tenant, items, deal] = await Promise.all([
    loadTenant(tenantId),
    crm.listProposalItems(tenantId, proposalId),
    crm.getDealById(tenantId, proposal.dealId),
  ]);
  const contact = deal?.contactId ? await crm.getContactById(tenantId, deal.contactId) : null;

  const clinicName = tenant?.name || "Clínica";
  const logoBuffer = decodeDataUrl(tenant?.logoUrl ?? null);

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Proposta #${proposal.id}`, Author: clinicName } });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // Header
  const headerY = 48;
  if (logoBuffer) {
    try { doc.image(logoBuffer, 48, headerY, { fit: [80, 60] }); } catch { /* ignore bad images */ }
  }
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(clinicName, 140, headerY, { width: 400 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(10).text("Proposta comercial", 140, headerY + 24);

  doc.fillColor(LIME).rect(48, headerY + 70, 500, 3).fill();

  // Title
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(22).text(`Proposta #${proposal.id}`, 48, headerY + 95);
  const issued = proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString("pt-BR") : "—";
  doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(`Emitida em ${issued}`, 48, headerY + 122);

  // Client block
  let cursorY = headerY + 155;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("Cliente", 48, cursorY);
  cursorY += 18;
  doc.fillColor(NAVY).font("Helvetica").fontSize(11).text(contact?.name || "—", 48, cursorY);
  cursorY += 14;
  if (contact?.email) {
    doc.fillColor(MUTED).fontSize(10).text(contact.email, 48, cursorY);
    cursorY += 13;
  }
  if (contact?.phone || contact?.phoneE164) {
    doc.fillColor(MUTED).fontSize(10).text(contact.phoneE164 || contact.phone || "", 48, cursorY);
    cursorY += 13;
  }
  if (contact?.docId) {
    doc.fillColor(MUTED).fontSize(10).text(`CPF/CNPJ: ${contact.docId}`, 48, cursorY);
    cursorY += 13;
  }

  // Items table
  cursorY += 16;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("Itens", 48, cursorY);
  cursorY += 18;

  const tableX = 48;
  const colDesc = tableX;
  const colQty = tableX + 320;
  const colUnit = tableX + 370;
  const colTotal = tableX + 460;
  const tableWidth = 499;

  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9);
  doc.text("Descrição", colDesc, cursorY);
  doc.text("Qtd", colQty, cursorY, { width: 40, align: "right" });
  doc.text("Unitário", colUnit, cursorY, { width: 80, align: "right" });
  doc.text("Total", colTotal, cursorY, { width: 87, align: "right" });
  cursorY += 14;
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(tableX, cursorY).lineTo(tableX + tableWidth, cursorY).stroke();
  cursorY += 6;

  if (!items.length) {
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(10).text("Nenhum item descrito.", colDesc, cursorY);
    cursorY += 18;
  } else {
    for (const it of items) {
      const rowH = Math.max(18, doc.font("Helvetica").fontSize(10).heightOfString(it.title || "—", { width: 310 }) + 4);
      if (cursorY + rowH > 770) { doc.addPage(); cursorY = 60; }
      doc.fillColor(NAVY).font("Helvetica").fontSize(10);
      doc.text(it.title || "—", colDesc, cursorY, { width: 310 });
      doc.text(String(it.qty ?? 1), colQty, cursorY, { width: 40, align: "right" });
      doc.text(brl(it.unitPriceCents), colUnit, cursorY, { width: 80, align: "right" });
      doc.text(brl(it.totalCents), colTotal, cursorY, { width: 87, align: "right" });
      cursorY += rowH + 4;
      doc.strokeColor(BORDER).lineWidth(0.3).moveTo(tableX, cursorY).lineTo(tableX + tableWidth, cursorY).stroke();
      cursorY += 4;
    }
  }

  // Total
  cursorY += 12;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text("Total", colUnit, cursorY, { width: 80, align: "right" });
  doc.fillColor(LIME).fontSize(16).text(brl(proposal.totalCents), colTotal, cursorY - 2, { width: 87, align: "right" });

  // Payment info
  if (proposal.asaasInvoiceUrl) {
    cursorY += 50;
    if (cursorY > 720) { doc.addPage(); cursorY = 60; }
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("Pagamento", 48, cursorY);
    cursorY += 16;
    doc.fillColor(NAVY).font("Helvetica").fontSize(10).text("Acesse o link abaixo para realizar o pagamento (PIX, boleto ou cartão):", 48, cursorY, { width: 500 });
    cursorY += 18;
    doc.fillColor(LIME).font("Helvetica").fontSize(10).text(proposal.asaasInvoiceUrl, 48, cursorY, { width: 500, link: proposal.asaasInvoiceUrl, underline: true });
  }

  // Footer
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(
    `${clinicName} · Proposta #${proposal.id} · ${issued}`,
    48, 800, { width: 500, align: "center" }
  );

  doc.end();
  await done;
  const buffer = Buffer.concat(chunks);
  return { buffer, fileName: `proposta-${proposal.id}.pdf` };
}
