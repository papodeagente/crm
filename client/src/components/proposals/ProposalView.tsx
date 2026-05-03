/**
 * ProposalView — render visual da proposta com a marca do tenant.
 * Compartilhado entre /p/:token (público) e o preview do editor.
 *
 * Layout reflete o PDF para o cliente ver exatamente o que vai chegar.
 */

import type { ReactNode } from "react";
import { Calendar, ExternalLink } from "lucide-react";

export interface ProposalViewItem {
  id: number | string;
  title: string;
  description?: string | null;
  qty: number;
  unit?: string | null;
  unitPriceCents: number;
  discountCents?: number;
  totalCents: number;
}

export interface ProposalViewBranding {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  footerText?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
}

export interface ProposalViewClient {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  docId?: string | null;
}

export interface ProposalViewData {
  id: number;
  status?: string;
  currency?: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes?: string | null;
  validUntil?: string | Date | null;
  sentAt?: string | Date | null;
  client?: ProposalViewClient | null;
  asaasInvoiceUrl?: string | null;
  isExpired?: boolean;
  items: ProposalViewItem[];
  branding?: ProposalViewBranding | null;
}

function brl(cents: number, currency = "BRL") {
  return ((cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function fmtDate(d: any) {
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

export default function ProposalView({
  data,
  bottomSlot,
}: {
  data: ProposalViewData;
  /** Conteúdo extra a exibir abaixo dos itens (botões de aceitar, etc.). */
  bottomSlot?: ReactNode;
}) {
  const branding = data.branding || {};
  const primary = branding.primaryColor || "#5A8A1F";
  const currency = data.currency || "BRL";
  const fontFamily = branding.fontFamily ? `${branding.fontFamily}, Inter, sans-serif` : undefined;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border overflow-hidden" style={{ fontFamily }}>
      {/* Banner topo */}
      <div className="h-1.5" style={{ backgroundColor: primary }} />

      {/* Header */}
      <div className="p-6 sm:p-8 border-b flex items-start gap-4">
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt={branding.name || "Logo"}
            className="h-14 w-14 object-contain rounded-md shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{branding.name || "Empresa"}</h1>
          <p className="text-sm text-muted-foreground">Proposta comercial</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Proposta</p>
          <p className="text-lg font-bold">#{data.id}</p>
          {data.sentAt && <p className="text-xs text-muted-foreground">Emitida em {fmtDate(data.sentAt)}</p>}
        </div>
      </div>

      {/* Cliente */}
      {data.client && (
        <div className="p-6 sm:p-8 border-b">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Proposta para</p>
          <p className="text-lg font-bold">{data.client.name || "—"}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            {data.client.email && <span>{data.client.email}</span>}
            {data.client.phone && <span>{data.client.phone}</span>}
            {data.client.docId && <span>CPF/CNPJ: {formatDocId(data.client.docId)}</span>}
          </div>
          {data.validUntil && !data.isExpired && (
            <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Válida até {fmtDate(data.validUntil)}
            </p>
          )}
        </div>
      )}

      {/* Itens */}
      <div className="p-6 sm:p-8">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Itens</h2>
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: primary }} className="text-white">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-xs">Descrição</th>
                <th className="text-center px-2 py-2 font-semibold text-xs w-12">Qtd</th>
                <th className="text-center px-2 py-2 font-semibold text-xs w-12 hidden sm:table-cell">Unid.</th>
                <th className="text-right px-2 py-2 font-semibold text-xs w-24 hidden sm:table-cell">Preço</th>
                <th className="text-right px-3 py-2 font-semibold text-xs w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground italic text-sm">
                    Nenhum item.
                  </td>
                </tr>
              ) : data.items.map((item, idx) => {
                const imageUrl = (item as any).imageUrl as string | null | undefined;
                return (
                <tr key={item.id} className={`border-t ${idx % 2 ? "bg-slate-50/50 dark:bg-slate-800/30" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover border border-border/50 shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-2 py-3 tabular-nums">{item.qty}</td>
                  <td className="text-center px-2 py-3 text-muted-foreground hidden sm:table-cell">{item.unit || "un"}</td>
                  <td className="text-right px-2 py-3 hidden sm:table-cell tabular-nums">{brl(item.unitPriceCents, currency)}</td>
                  <td className="text-right px-3 py-3 font-bold tabular-nums">{brl(item.totalCents, currency)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className="mt-5 ml-auto max-w-xs space-y-1.5 text-sm">
          {data.subtotalCents !== data.totalCents && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(data.subtotalCents, currency)}</span>
              </div>
              {data.discountCents > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Desconto</span>
                  <span className="tabular-nums">-{brl(data.discountCents, currency)}</span>
                </div>
              )}
              {data.taxCents > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Impostos / taxas</span>
                  <span className="tabular-nums">+{brl(data.taxCents, currency)}</span>
                </div>
              )}
            </>
          )}
          <div className="border-t pt-2 mt-2 flex justify-between items-baseline">
            <span className="font-bold text-base">Total</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: primary }}>
              {brl(data.totalCents, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Notas */}
      {data.notes && (
        <div className="p-6 sm:p-8 border-t">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Observações</h2>
          <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      {bottomSlot}

      {/* Pagamento */}
      {data.asaasInvoiceUrl && (
        <div className="p-6 sm:p-8 border-t text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pagamento</p>
          <a
            href={data.asaasInvoiceUrl}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primary }}
          >
            <ExternalLink className="h-4 w-4" />
            Pagar com PIX, Boleto ou Cartão
          </a>
          <p className="text-xs text-muted-foreground mt-2">Pagamento processado via Asaas — seguro e rastreável</p>
        </div>
      )}

      {/* Footer */}
      {(branding.address || branding.phone || branding.website || branding.footerText) && (
        <div className="p-6 sm:p-8 border-t bg-slate-50 dark:bg-slate-800/20 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {branding.address && <span>{branding.address}</span>}
            {branding.phone && <span>{branding.phone}</span>}
            {branding.website && <span>{branding.website}</span>}
          </div>
          {branding.footerText && <p className="mt-2">{branding.footerText}</p>}
        </div>
      )}
    </div>
  );
}
