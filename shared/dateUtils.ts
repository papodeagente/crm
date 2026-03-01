/**
 * Utilitário centralizado de formatação de datas com timezone America/Sao_Paulo (UTC-3).
 * Todas as datas exibidas no sistema devem usar estas funções para garantir consistência.
 */

export const SYSTEM_TIMEZONE = "America/Sao_Paulo";
export const SYSTEM_LOCALE = "pt-BR";

/** Formata data: 01/03/2026 */
export function formatDate(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(SYSTEM_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata data e hora: 01/03/2026, 14:30 */
export function formatDateTime(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(SYSTEM_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata apenas hora: 14:30 */
export function formatTime(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleTimeString(SYSTEM_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata hora com segundos: 14:30:45 */
export function formatTimeWithSeconds(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleTimeString(SYSTEM_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata data curta: 01 mar */
export function formatDateShort(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(SYSTEM_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata data longa: segunda-feira, 1 de março de 2026 */
export function formatDateLong(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(SYSTEM_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata mês e ano: março de 2026 */
export function formatMonthYear(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(SYSTEM_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata data completa com hora: 01/03/2026 14:30:45 */
export function formatFullDateTime(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString(SYSTEM_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata data curta para logs: 01/03, 14:30 */
export function formatDateTimeShort(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString(SYSTEM_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata data compacta para mensagens: 01/03/26, 14:30 */
export function formatDateTimeCompact(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString(SYSTEM_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Formata data com dia da semana e mês por extenso: 1 de março */
export function formatDayMonth(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(SYSTEM_LOCALE, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: SYSTEM_TIMEZONE,
  });
}

/** Retorna a data atual no timezone do sistema */
export function nowInSystemTZ(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: SYSTEM_TIMEZONE }));
}

/** Formata data para range: 01 mar — 07 mar 2026 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const s = new Date(start).toLocaleDateString(SYSTEM_LOCALE, { day: "numeric", month: "short", timeZone: SYSTEM_TIMEZONE });
  const e = new Date(end).toLocaleDateString(SYSTEM_LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: SYSTEM_TIMEZONE });
  return `${s} — ${e}`;
}
