/**
 * Normalize text for accent-insensitive, case-insensitive client-side search.
 * Uses Unicode NFD normalization to decompose accented characters,
 * then strips combining diacritical marks.
 *
 * "José" → "jose", "São Paulo" → "sao paulo"
 */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
