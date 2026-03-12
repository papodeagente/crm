import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname || "";
  const isLocal = LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
  const isSecure = isSecureRequest(req);

  // Use 'lax' for same-site requests (custom domains, production)
  // This is more compatible with modern browsers that block 'none' cookies
  // Only use 'none' for cross-origin scenarios (e.g., manus.computer dev preview)
  const isManusDev = hostname.includes('manus.computer') || hostname.includes('manus.space');
  const sameSite: CookieOptions["sameSite"] = isManusDev ? "none" : "lax";

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure: isManusDev ? true : isSecure,
  };
}
