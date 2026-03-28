export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// SaaS login - redirect to local login page instead of Manus OAuth
const BASE = import.meta.env.PROD ? "/crm" : "";

export const getLoginUrl = (returnPath?: string) => {
  const path = returnPath || window.location.pathname;
  return `${BASE}/login?redirect=${encodeURIComponent(path)}`;
};
