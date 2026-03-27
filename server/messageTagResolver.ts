/**
 * ═══════════════════════════════════════════════════════════════
 * RESOLUÇÃO CENTRAL DE TAGS DINÂMICAS PARA MENSAGENS
 * ═══════════════════════════════════════════════════════════════
 *
 * Função única que resolve todas as tags de mensagem no contexto
 * de uma negociação (deal). Usada por:
 * - Envio manual de mensagem WhatsApp
 * - Automação de tarefa por etapa
 * - Envio em massa (bulk send CRM)
 * - Qualquer outro ponto de disparo de mensagem
 */

import { getDb } from "./db";
import { dealProducts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export interface DealMessageContext {
  // Contact data
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  // Deal data
  dealTitle?: string | null;
  dealValueCents?: number | null;
  stageName?: string | null;
  companyName?: string | null;
  // Optional: pre-fetched product name (avoids extra query)
  mainProductName?: string | null;
}

/**
 * Resolve todas as tags dinâmicas em um template de mensagem.
 * 
 * Tags suportadas:
 * - {nome} → Nome completo do contato
 * - {primeiro_nome} → Primeiro nome do contato
 * - {email} → E-mail do contato
 * - {telefone} → Telefone do contato
 * - {negociacao} → Título da negociação
 * - {nome_oportunidade} → Nome da oportunidade (alias de {negociacao})
 * - {valor} → Valor da negociação formatado em BRL
 * - {etapa} → Etapa atual do funil
 * - {empresa} → Empresa do contato
 * - {produto_principal} → Produto de maior valor da negociação
 * 
 * Se uma tag não puder ser resolvida, ela é substituída por string vazia.
 * Nunca lança erro — segurança para não quebrar envios.
 */
export function interpolateDealMessage(
  template: string,
  ctx: DealMessageContext
): string {
  const name = ctx.contactName || "";
  const firstName = name.split(" ")[0] || "";
  const valor = ctx.dealValueCents
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.dealValueCents / 100)
    : "";

  return template
    .replace(/\{nome\}/gi, name)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{email\}/gi, ctx.contactEmail || "")
    .replace(/\{telefone\}/gi, ctx.contactPhone || "")
    .replace(/\{negociacao\}/gi, ctx.dealTitle || "")
    .replace(/\{nome_oportunidade\}/gi, ctx.dealTitle || "")
    .replace(/\{valor\}/gi, valor)
    .replace(/\{etapa\}/gi, ctx.stageName || "")
    .replace(/\{empresa\}/gi, ctx.companyName || "")
    .replace(/\{produto_principal\}/gi, ctx.mainProductName || "");
}

/**
 * Busca o nome do produto de maior valor vinculado a uma negociação.
 * 
 * Regras:
 * - Se existir apenas 1 produto, retorna esse
 * - Se existirem vários, retorna o de maior finalPriceCents (ou unitPriceCents)
 * - Se não existir produto, retorna null (sem erro)
 */
export async function getMainProductName(
  tenantId: number,
  dealId: number
): Promise<string | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const products = await db
      .select({
        name: dealProducts.name,
        finalPriceCents: dealProducts.finalPriceCents,
        unitPriceCents: dealProducts.unitPriceCents,
      })
      .from(dealProducts)
      .where(
        and(
          eq(dealProducts.tenantId, tenantId),
          eq(dealProducts.dealId, dealId)
        )
      )
      .orderBy(desc(dealProducts.finalPriceCents))
      .limit(5);

    if (products.length === 0) return null;
    if (products.length === 1) return products[0].name;

    // Return the one with highest value
    let best = products[0];
    for (const p of products) {
      const pValue = (p.finalPriceCents ?? 0) || (p.unitPriceCents ?? 0);
      const bestValue = (best.finalPriceCents ?? 0) || (best.unitPriceCents ?? 0);
      if (pValue > bestValue) best = p;
    }
    return best.name;
  } catch (err) {
    console.error("[MessageTagResolver] Error fetching main product:", err);
    return null;
  }
}

/**
 * Resolve tags em um template de mensagem para um deal específico.
 * Busca automaticamente o produto principal se necessário.
 * 
 * Uso simplificado para automações:
 * const message = await resolveMessageTags(template, tenantId, dealId, ctx);
 */
export async function resolveMessageTags(
  template: string,
  tenantId: number,
  dealId: number,
  ctx: DealMessageContext
): Promise<string> {
  // Se o template usa {produto_principal} e não foi pré-carregado, buscar
  if (
    /\{produto_principal\}/i.test(template) &&
    ctx.mainProductName === undefined
  ) {
    ctx.mainProductName = await getMainProductName(tenantId, dealId);
  }

  return interpolateDealMessage(template, ctx);
}
