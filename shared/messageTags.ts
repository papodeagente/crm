/**
 * ═══════════════════════════════════════════════════════════════
 * FONTE CENTRAL DE TAGS DINÂMICAS PARA MENSAGENS
 * ═══════════════════════════════════════════════════════════════
 *
 * Todas as telas de disparo de mensagem do sistema devem usar
 * estas definições para garantir consistência.
 *
 * Para adicionar uma nova tag:
 * 1. Adicione aqui na lista correspondente
 * 2. Implemente a resolução em server/messageTagResolver.ts
 */

export interface MessageTag {
  /** A variável com chaves, ex: "{nome}" */
  var: string;
  /** Descrição curta para exibição na UI */
  desc: string;
  /** Exemplo de valor para preview */
  example: string;
}

// ─── Tags para contexto de CONTATOS (RFV, importação, etc.) ───
export const CONTACT_MESSAGE_TAGS: MessageTag[] = [
  { var: "{nome}", desc: "Nome completo do contato", example: "João da Silva" },
  { var: "{primeiro_nome}", desc: "Primeiro nome", example: "João" },
  { var: "{email}", desc: "E-mail do contato", example: "joao@email.com" },
  { var: "{telefone}", desc: "Telefone do contato", example: "(11) 99999-0000" },
];

// ─── Tags para contexto de NEGOCIAÇÕES (CRM deals) ───
export const CRM_DEAL_MESSAGE_TAGS: MessageTag[] = [
  { var: "{nome}", desc: "Nome do contato principal", example: "João da Silva" },
  { var: "{primeiro_nome}", desc: "Primeiro nome do contato", example: "João" },
  { var: "{email}", desc: "E-mail do contato", example: "joao@email.com" },
  { var: "{telefone}", desc: "Telefone do contato", example: "(11) 99999-0000" },
  { var: "{negociacao}", desc: "Título da negociação", example: "Pacote Europa 2026" },
  { var: "{nome_oportunidade}", desc: "Nome da oportunidade/negociação", example: "Pacote Europa 2026" },
  { var: "{valor}", desc: "Valor da negociação", example: "R$ 5.000,00" },
  { var: "{etapa}", desc: "Etapa atual do funil", example: "Cotação" },
  { var: "{empresa}", desc: "Empresa do contato", example: "Viagens ABC" },
  { var: "{produto_principal}", desc: "Produto de maior valor da negociação", example: "Passagem Aérea SP-Paris" },
];

// ─── Tags para contexto de RD Station (leads) ───
export const RD_STATION_MESSAGE_TAGS: MessageTag[] = [
  { var: "{nome}", desc: "Nome completo do lead", example: "João Silva" },
  { var: "{primeiro_nome}", desc: "Primeiro nome", example: "João" },
  { var: "{telefone}", desc: "Telefone do lead", example: "+5511999887766" },
  { var: "{email}", desc: "E-mail do lead", example: "joao@email.com" },
  { var: "{origem}", desc: "Origem/fonte do lead", example: "Google Ads" },
  { var: "{campanha}", desc: "Campanha de origem", example: "Promo Verão" },
];

/**
 * Gera um mapa de exemplos para preview de mensagem.
 * Uso: previewExamples(CRM_DEAL_MESSAGE_TAGS) → { "{nome}": "João da Silva", ... }
 */
export function previewExamples(tags: MessageTag[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const t of tags) {
    map[t.var] = t.example;
  }
  return map;
}

/**
 * Aplica exemplos de preview a um template de mensagem.
 */
export function previewMessage(template: string, tags: MessageTag[]): string {
  let result = template;
  for (const t of tags) {
    result = result.replace(new RegExp(t.var.replace(/[{}]/g, "\\$&"), "gi"), t.example);
  }
  return result;
}
