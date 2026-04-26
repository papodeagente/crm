/**
 * PhoneDisplay — Shows a phone number with country flag emoji + formatted number
 */
import { useMemo } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ensureBrazilPrefix } from "../../../../shared/phoneBR";

/** Map ISO country code → flag emoji */
function countryToFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  const offset = 0x1F1E6;
  return String.fromCodePoint(
    upper.charCodeAt(0) - 65 + offset,
    upper.charCodeAt(1) - 65 + offset
  );
}

interface PhoneDisplayProps {
  phone: string;
  size?: "sm" | "md";
  className?: string;
}

export default function PhoneDisplay({ phone, size = "sm", className = "" }: PhoneDisplayProps) {
  const { flag, formatted } = useMemo(() => {
    if (!phone) return { flag: "🌐", formatted: phone };

    // Ensure phone starts with + for parsing — força +55 em números BR sem country
    // code explícito (DDD+número sem +), evitando que DDDs que colidem com country
    // codes internacionais (47=Noruega, 31=Holanda, etc.) sejam mal interpretados.
    const input = ensureBrazilPrefix(phone);
    const parsed = parsePhoneNumberFromString(input);

    // For Brazilian numbers, always use manual formatting for consistent output
    const digits = input.replace(/\D/g, "");
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      const ddd = digits.substring(2, 4);
      const num = digits.substring(4);
      if (num.length === 9) {
        return { flag: "🇧🇷", formatted: `+55 ${ddd} ${num.substring(0, 5)} ${num.substring(5)}` };
      }
      if (num.length === 8) {
        return { flag: "🇧🇷", formatted: `+55 ${ddd} ${num.substring(0, 4)} ${num.substring(4)}` };
      }
    }

    if (parsed && parsed.country) {
      return {
        flag: countryToFlag(parsed.country),
        formatted: parsed.formatInternational().replace(/-/g, " "),
      };
    }

    return { flag: "🌐", formatted: input };
  }, [phone]);

  const textSize = size === "sm" ? "text-[12.5px]" : "text-[14px]";
  const flagSize = size === "sm" ? "text-[14px]" : "text-[16px]";

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={flagSize}>{flag}</span>
      <span className={`${textSize} text-muted-foreground`}>{formatted}</span>
    </span>
  );
}
