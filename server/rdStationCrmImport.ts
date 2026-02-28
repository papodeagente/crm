/**
 * RD Station CRM Import Module
 * Handles fetching data from RD Station CRM API v1 and importing into Entur OS
 */

const RD_CRM_BASE = "https://crm.rdstation.com/api/v1";

// ─── Types ───

export interface RdContact {
  _id: string;
  name: string;
  emails: Array<{ email: string }>;
  phones: Array<{ phone: string; type?: string; whatsapp?: boolean }>;
  title?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  skype?: string | null;
  notes?: string | null;
  organization_id?: string | null;
  birthday?: { day?: number; month?: number; year?: number } | null;
  contact_custom_fields?: Array<{ custom_field_id: string; value: string | null }>;
  deals?: Array<{ _id: string; name: string; win: boolean | null }>;
  created_at: string;
  updated_at: string;
}

export interface RdDeal {
  _id: string;
  id: string;
  name: string;
  amount_montly: number;
  amount_total: number;
  amount_unique: number;
  closed_at: string | null;
  win: boolean | null;
  hold: boolean | null;
  prediction_date: string | null;
  rating: number;
  interactions: number;
  last_activity_at: string | null;
  last_activity_content: string | null;
  created_at: string;
  updated_at: string;
  user?: { _id: string; name: string; email?: string } | null;
  contacts: Array<{
    _id?: string;
    name: string;
    emails: Array<{ email: string }>;
    phones: Array<{ phone: string; type?: string }>;
    title?: string | null;
  }>;
  deal_stage?: { _id: string; name: string; nickname?: string } | null;
  deal_custom_fields?: Array<{ custom_field_id: string; value: string | null }>;
  deal_products?: Array<{
    _id: string;
    name: string;
    price: number;
    amount: number;
    total: number;
    description?: string;
    product_id?: string;
    recurrence?: string;
    discount?: number;
    discount_type?: string;
  }>;
  markup?: string;
  markup_created?: string;
}

export interface RdOrganization {
  _id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  url?: string | null;
  organization_segments?: Array<{ _id: string; name: string }>;
  created_at: string;
  updated_at: string;
}

export interface RdProduct {
  _id: string;
  name: string;
  base_price: number;
  description?: string | null;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface RdTask {
  _id: string;
  subject: string;
  type: string;
  date: string;
  hour?: string;
  done: boolean;
  deal_id?: string | null;
  contact_id?: string | null;
  user?: { _id: string; name: string } | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RdPipeline {
  _id: string;
  name: string;
  deal_stages: Array<{
    _id: string;
    name: string;
    nickname?: string;
    order: number;
  }>;
  created_at: string;
}

export interface RdSource {
  _id: string;
  name: string;
  created_at: string;
}

export interface RdUser {
  _id: string;
  name: string;
  email: string;
  role?: string;
}

export interface RdCampaign {
  _id: string;
  name: string;
  created_at: string;
}

export interface RdLossReason {
  _id: string;
  name: string;
  created_at: string;
}

export interface RdCustomField {
  _id: string;
  label: string;
  field_type?: string;
  created_at: string;
}

// ─── API Helpers ───

async function rdFetch<T>(endpoint: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${RD_CRM_BASE}${endpoint}`);
  url.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RD Station CRM API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function rdFetchAllPaginated<T>(
  endpoint: string,
  token: string,
  listKey: string,
  extraParams: Record<string, string> = {},
  onProgress?: (fetched: number, total: number) => void,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let hasMore = true;
  let total = 0;

  while (hasMore) {
    const data = await rdFetch<any>(endpoint, token, {
      ...extraParams,
      page: String(page),
      limit: "200",
    });
    const items = data[listKey] || [];
    all.push(...items);
    total = data.total || all.length;
    hasMore = data.has_more === true;
    if (onProgress) onProgress(all.length, total);
    page++;
    // Safety: avoid infinite loops
    if (page > 500) break;
  }

  return all;
}

// ─── Public API ───

export async function validateRdCrmToken(token: string): Promise<{ valid: boolean; accountName?: string; userCount?: number; error?: string }> {
  try {
    const data = await rdFetch<any>("/users", token, { limit: "1" });
    // If we can list users, the token is valid
    const users = data.users || data || [];
    return {
      valid: true,
      userCount: Array.isArray(users) ? users.length : 0,
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

export async function fetchRdCrmSummary(token: string): Promise<{
  contacts: number;
  deals: number;
  organizations: number;
  products: number;
  tasks: number;
  pipelines: number;
  users: number;
  campaigns: number;
  sources: number;
  lossReasons: number;
  customFields: number;
}> {
  // Fetch first page of each to get totals
  const [contactsData, dealsData, orgsData, productsData, tasksData, pipelinesData, usersData, campaignsData, sourcesData, lossReasonsData, customFieldsData] = await Promise.all([
    rdFetch<any>("/contacts", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/deals", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/organizations", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/products", token, { limit: "1" }).catch(() => ({ total: 0, products: [] })),
    rdFetch<any>("/tasks", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/deal_pipelines", token, { limit: "1" }).catch(() => ({ total: 0, deal_pipelines: [] })),
    rdFetch<any>("/users", token, { limit: "1" }).catch(() => ({ total: 0, users: [] })),
    rdFetch<any>("/campaigns", token, { limit: "1" }).catch(() => ({ total: 0, campaigns: [] })),
    rdFetch<any>("/deal_sources", token, { limit: "1" }).catch(() => ({ total: 0, deal_sources: [] })),
    rdFetch<any>("/deal_lost_reasons", token, { limit: "1" }).catch(() => ({ total: 0, deal_lost_reasons: [] })),
    rdFetch<any>("/custom_fields", token, { limit: "1" }).catch(() => ({ total: 0, custom_fields: [] })),
  ]);

  return {
    contacts: contactsData.total || 0,
    deals: dealsData.total || 0,
    organizations: orgsData.total || 0,
    products: productsData.total || (productsData.products || []).length,
    tasks: tasksData.total || 0,
    pipelines: pipelinesData.total || (pipelinesData.deal_pipelines || []).length,
    users: usersData.total || (usersData.users || usersData || []).length,
    campaigns: campaignsData.total || (campaignsData.campaigns || []).length,
    sources: sourcesData.total || (sourcesData.deal_sources || []).length,
    lossReasons: lossReasonsData.total || (lossReasonsData.deal_lost_reasons || []).length,
    customFields: customFieldsData.total || (customFieldsData.custom_fields || []).length,
  };
}

export async function fetchAllContacts(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdContact[]> {
  return rdFetchAllPaginated<RdContact>("/contacts", token, "contacts", {}, onProgress);
}

export async function fetchAllDeals(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdDeal[]> {
  return rdFetchAllPaginated<RdDeal>("/deals", token, "deals", {}, onProgress);
}

export async function fetchAllOrganizations(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdOrganization[]> {
  return rdFetchAllPaginated<RdOrganization>("/organizations", token, "organizations", {}, onProgress);
}

export async function fetchAllProducts(token: string): Promise<RdProduct[]> {
  const data = await rdFetch<any>("/products", token, { limit: "200" });
  return data.products || data || [];
}

export async function fetchAllTasks(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdTask[]> {
  return rdFetchAllPaginated<RdTask>("/tasks", token, "tasks", {}, onProgress);
}

export async function fetchAllPipelines(token: string): Promise<RdPipeline[]> {
  const data = await rdFetch<any>("/deal_pipelines", token, { limit: "200" });
  return data.deal_pipelines || data || [];
}

export async function fetchAllUsers(token: string): Promise<RdUser[]> {
  const data = await rdFetch<any>("/users", token, { limit: "200" });
  return data.users || data || [];
}

export async function fetchAllCampaigns(token: string): Promise<RdCampaign[]> {
  const data = await rdFetch<any>("/campaigns", token, { limit: "200" });
  return data.campaigns || data || [];
}

export async function fetchAllSources(token: string): Promise<RdSource[]> {
  const data = await rdFetch<any>("/deal_sources", token, { limit: "200" });
  return data.deal_sources || data || [];
}

export async function fetchAllLossReasons(token: string): Promise<RdLossReason[]> {
  const data = await rdFetch<any>("/deal_lost_reasons", token, { limit: "200" });
  return data.deal_lost_reasons || data || [];
}

export async function fetchAllCustomFields(token: string): Promise<RdCustomField[]> {
  const data = await rdFetch<any>("/custom_fields", token, { limit: "200" });
  return data.custom_fields || data || [];
}
