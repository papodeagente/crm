/**
 * Utilitário compartilhado para normalização de telefones brasileiros.
 *
 * Regra do negócio: se o usuário digita um número sem `+`, assumimos BR por
 * padrão — desde que ele case com o padrão BR (DDD válido + 8 ou 9 dígitos).
 *
 * Isso evita que números como "47 984159004" (DDD 47 = Santa Catarina) sejam
 * interpretados por libphonenumber-js como +47 (Noruega) só porque faltou o
 * `+55`. DDDs brasileiros que colidem com country codes internacionais:
 *   27, 31, 34, 39, 41, 42, 44, 47, 48, 49, 51, 52, 54, 61–66, 81–89, 91–99.
 *
 * Usar tanto no servidor (backfill, normalização redundante) quanto no cliente
 * (PhoneDisplay) para garantir decisão idêntica nos dois lados.
 */

/** DDDs ativos do Brasil (lista explícita — há buracos na faixa 11–99). */
export const BR_DDD = new Set<number>([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24,
  27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Garante o prefixo `+55` em números que seguem o padrão BR sem country code
 * explícito. Se o input já começa com `+`, é respeitado sem alterações.
 *
 * Exemplos:
 *   "47 984159004"     → "+5547984159004"   (DDD 47 + 9 dígitos)
 *   "47984159004"      → "+5547984159004"   (idem, sem espaço)
 *   "+47984159004"     → "+47984159004"     (explícito → respeita)
 *   "5547984159004"    → "+5547984159004"   (55 + DDD válido → só prefixa +)
 *   "11 2345-6789"     → "+551123456789"    (fixo SP, 10 dígitos)
 *   "+1 415 555 1234"  → "+14155551234"     (US explícito → respeita)
 *   "25984159004"      → "+25984159004"     (DDD 25 não existe → não força BR)
 */
export function ensureBrazilPrefix(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  // Respeita country code explícito.
  if (trimmed.startsWith("+")) return trimmed;

  // Só dígitos, strip zeros à esquerda (formatos "055…" viraram "55…").
  let d = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return trimmed;

  // Já tem 55 na frente e tamanho plausível BR → só prefixa `+`.
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = Number.parseInt(d.substring(2, 4), 10);
    if (BR_DDD.has(ddd)) return `+${d}`;
  }

  // 10 dígitos = DDD + 8 (fixo ou mobile antigo sem 9º dígito).
  if (d.length === 10) {
    const ddd = Number.parseInt(d.substring(0, 2), 10);
    if (BR_DDD.has(ddd)) return `+55${d}`;
  }

  // 11 dígitos = DDD + 9 + 8 (mobile com 9º dígito).
  if (d.length === 11) {
    const ddd = Number.parseInt(d.substring(0, 2), 10);
    if (BR_DDD.has(ddd) && d[2] === "9") return `+55${d}`;
  }

  // Fallback: prefixa `+` cru e deixa libphonenumber decidir (preserva casos
  // internacionais legítimos salvos sem `+`, p.ex. "14155551234" americano).
  return `+${d}`;
}
