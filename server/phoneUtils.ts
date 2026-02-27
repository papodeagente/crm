/**
 * Utility module for Brazilian phone number normalization.
 * 
 * Brazilian mobile numbers follow the pattern: +55 DD 9NNNN-NNNN (13 digits total)
 * WhatsApp JIDs may come in different formats:
 *   - 5584999838420@s.whatsapp.net (13 digits, with 9th digit — CORRECT)
 *   - 558499838420@s.whatsapp.net  (12 digits, without 9th digit — OLD FORMAT)
 *   - 84999838420 (11 digits, no country code)
 *   - +5584999838420 (with + prefix)
 * 
 * This module normalizes ALL phone numbers to the standard format:
 *   55 + DD(2) + 9 + NNNNNNNN(8) = 13 digits → JID: 5584999838420@s.whatsapp.net
 * 
 * The canonical format for storage and display is: +55DDNNNNNNNNN (e.g. +5584999838420)
 */

/**
 * Extract only digits from any phone string.
 */
function extractDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Normalize a Brazilian phone number to the canonical format: 55DDNNNNNNNNN (13 digits).
 * Always ensures the 9th digit is present for mobile numbers.
 * 
 * @param input - Phone number in any format (with +, spaces, dashes, or raw digits)
 * @returns Normalized 13-digit string (e.g. "5584999838420") or original digits if not Brazilian
 */
export function normalizeBrazilianPhone(input: string): string {
  let digits = extractDigits(input);
  
  // If empty, return as-is
  if (!digits) return digits;

  // Remove leading 0 if present (some formats use 055...)
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  // Add country code 55 if not present
  if (!digits.startsWith("55")) {
    // Could be DD+number (10 or 11 digits) or just number (8 or 9 digits)
    if (digits.length <= 11) {
      digits = `55${digits}`;
    }
  }

  // Now digits should start with 55
  if (!digits.startsWith("55")) return digits;

  const ddd = digits.substring(2, 4);
  const rest = digits.substring(4);

  // Brazilian mobile numbers should have 9 digits after DDD (starting with 9)
  // If we have 8 digits after DDD, add the 9th digit
  if (rest.length === 8) {
    digits = `55${ddd}9${rest}`;
  }
  // If we have 9 digits and it starts with 9, it's already correct
  // If we have 9 digits but doesn't start with 9, leave as-is (landline or special)

  return digits;
}

/**
 * Normalize a WhatsApp JID to use the canonical Brazilian phone format.
 * Handles both individual (@s.whatsapp.net) and group (@g.us) JIDs.
 * 
 * @param jid - WhatsApp JID (e.g. "558499838420@s.whatsapp.net")
 * @returns Normalized JID (e.g. "5584999838420@s.whatsapp.net")
 */
export function normalizeJid(jid: string): string {
  // Don't touch group JIDs
  if (jid.endsWith("@g.us")) return jid;
  
  // Don't touch status broadcast
  if (jid === "status@broadcast") return jid;
  
  // Extract the number part and suffix
  const atIndex = jid.indexOf("@");
  if (atIndex === -1) {
    // No @ sign — treat as raw phone number, normalize and add suffix
    const normalized = normalizeBrazilianPhone(jid);
    return `${normalized}@s.whatsapp.net`;
  }
  
  const numberPart = jid.substring(0, atIndex);
  const suffix = jid.substring(atIndex); // e.g. "@s.whatsapp.net"
  
  // Only normalize Brazilian numbers (starting with 55)
  const digits = extractDigits(numberPart);
  if (digits.startsWith("55") || digits.length <= 11) {
    const normalized = normalizeBrazilianPhone(digits);
    return `${normalized}${suffix}`;
  }
  
  return jid;
}

/**
 * Convert a phone number to a normalized WhatsApp JID.
 * 
 * @param phone - Phone number in any format
 * @returns Normalized JID (e.g. "5584999838420@s.whatsapp.net")
 */
export function phoneToJid(phone: string): string {
  const normalized = normalizeBrazilianPhone(phone);
  return `${normalized}@s.whatsapp.net`;
}

/**
 * Convert a WhatsApp JID to a formatted phone number.
 * 
 * @param jid - WhatsApp JID (e.g. "5584999838420@s.whatsapp.net")
 * @returns Formatted phone string (e.g. "+5584999838420")
 */
export function jidToPhone(jid: string): string {
  const digits = extractDigits(jid.replace(/@.*$/, ""));
  const normalized = normalizeBrazilianPhone(digits);
  return `+${normalized}`;
}

/**
 * Format a phone number for display: +55 (84) 99983-8420
 * 
 * @param phone - Phone number in any format
 * @returns Formatted display string
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = normalizeBrazilianPhone(extractDigits(phone));
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.substring(2, 4);
    const part1 = digits.substring(4, 9);
    const part2 = digits.substring(9, 13);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  return `+${digits}`;
}

/**
 * Check if two phone numbers/JIDs refer to the same person.
 * Normalizes both before comparing.
 * 
 * @param a - First phone/JID
 * @param b - Second phone/JID
 * @returns true if they represent the same number
 */
export function isSamePhone(a: string, b: string): boolean {
  const normA = normalizeBrazilianPhone(extractDigits(a.replace(/@.*$/, "")));
  const normB = normalizeBrazilianPhone(extractDigits(b.replace(/@.*$/, "")));
  return normA === normB && normA.length > 0;
}

/**
 * Generate all possible JID variants for a Brazilian phone number.
 * Used for querying messages that may have been stored with different formats.
 * 
 * @param phone - Phone number in any format
 * @returns Array of possible JIDs (e.g. ["5584999838420@s.whatsapp.net", "558499838420@s.whatsapp.net"])
 */
export function getAllJidVariants(phone: string): string[] {
  const digits = extractDigits(phone.replace(/@.*$/, ""));
  const normalized = normalizeBrazilianPhone(digits);
  
  if (!normalized.startsWith("55") || normalized.length < 12) {
    return [`${normalized}@s.whatsapp.net`];
  }
  
  const ddd = normalized.substring(2, 4);
  const rest = normalized.substring(4);
  
  const variants = new Set<string>();
  
  // Always add the normalized version (13 digits with 9th digit)
  variants.add(`${normalized}@s.whatsapp.net`);
  
  // Add version without 9th digit (12 digits) — old WhatsApp format
  if (rest.length === 9 && rest.startsWith("9")) {
    variants.add(`55${ddd}${rest.substring(1)}@s.whatsapp.net`);
  }
  
  // Add version with 9th digit if it was missing
  if (rest.length === 8) {
    variants.add(`55${ddd}9${rest}@s.whatsapp.net`);
  }
  
  return Array.from(variants);
}
