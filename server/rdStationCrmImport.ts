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
  deal_source?: { _id: string; name: string } | null;
  campaign?: { _id: string; name: string } | null;
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
  deal_lost_reason?: { _id: string; name: string } | null;
  organization?: { _id: string; id?: string; name: string; address?: string | null } | null;
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
  base_price: string | number;
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
  users?: Array<{ _id: string; name: string }>;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface RdPipeline {
  id: string;
  _id?: string;
  name: string;
  order?: number;
  deal_stages: Array<{
    _id: string;
    id?: string;
    name: string;
    nickname?: string;
    order: number;
    objective?: string | null;
    description?: string | null;
  }>;
  created_at?: string;
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
  active?: boolean;
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
  type?: string;
  for?: string;
  created_at: string;
}

// ─── API Helpers ───

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

async function rdFetch<T>(endpoint: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${RD_CRM_BASE}${endpoint}`);
  url.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Retry on 429 (rate limit) or 5xx (server error)
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_BASE_MS * Math.pow(2, attempt);
        if (attempt < MAX_RETRIES) {
          console.log(`[RD Retry] ${endpoint} → ${res.status}, tentativa ${attempt + 1}/${MAX_RETRIES}, aguardando ${waitMs}ms...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        const body = await res.text().catch(() => "");
        throw new Error(`RD Station CRM API error ${res.status} após ${MAX_RETRIES} tentativas: ${body.substring(0, 200)}`);
      }

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`RD Station CRM API error ${res.status}: ${body.substring(0, 200)}`);
      }

      if (contentType.includes("text/html")) {
        if (attempt < MAX_RETRIES) {
          console.log(`[RD Retry] ${endpoint} → HTML response, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
          continue;
        }
        throw new Error(`RD Station retornou HTML em vez de JSON para ${endpoint}. Pode ser rate limit ou erro temporário.`);
      }

      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`Resposta inválida do RD Station para ${endpoint}: ${text.substring(0, 100)}`);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      // Retry on network errors (abort, ECONNRESET, etc.)
      if (attempt < MAX_RETRIES && (err.name === "AbortError" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.message?.includes("fetch failed"))) {
        console.log(`[RD Retry] ${endpoint} → ${err.message}, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error(`rdFetch falhou após ${MAX_RETRIES} tentativas`);
}

async function rdFetchAllPaginated<T extends { _id?: string }>(
  endpoint: string,
  token: string,
  listKey: string,
  extraParams: Record<string, string> = {},
  onProgress?: (fetched: number, total: number) => void,
): Promise<T[]> {
  const LIMIT = 200;
  const MAX_PAGE = 50; // page * limit must be <= 10000

  // Helper: fetch one window of up to 10000 records
  async function fetchWindow(windowParams: Record<string, string>): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGE) {
      const data = await rdFetch<any>(endpoint, token, {
        ...extraParams,
        ...windowParams,
        page: String(page),
        limit: String(LIMIT),
      });
      const batch = data[listKey] || [];
      items.push(...batch);
      const total = data.total || items.length;
      hasMore = data.has_more === true;
      if (onProgress) onProgress(items.length, total);
      page++;
      if (hasMore && page <= MAX_PAGE) await new Promise(r => setTimeout(r, 100));
    }
    return items;
  }

  // First pass: default order (newest first)
  const firstBatch = await fetchWindow({});
  const total = firstBatch.length;

  // If we got all records (< 10000), return immediately
  // Check: did we hit the 10000 limit?
  if (firstBatch.length < MAX_PAGE * LIMIT) {
    return firstBatch;
  }

  console.log(`[RD Paginate] ${endpoint}: Got ${firstBatch.length} in first window, fetching reverse window...`);

  // Second pass: reverse order (oldest first) to get the remaining records
  const secondBatch = await fetchWindow({ order: "created_at", sort: "asc" });

  console.log(`[RD Paginate] ${endpoint}: Got ${secondBatch.length} in second window. Deduplicating...`);

  // Deduplicate by _id
  const seen = new Set<string>();
  const all: T[] = [];
  for (const item of [...firstBatch, ...secondBatch]) {
    const id = (item as any)._id || (item as any).id || "";
    if (id && !seen.has(id)) {
      seen.add(id);
      all.push(item);
    }
  }

  console.log(`[RD Paginate] ${endpoint}: After dedup: ${all.length} unique records (from ${firstBatch.length} + ${secondBatch.length})`);
  if (onProgress) onProgress(all.length, all.length);

  return all;
}

// ─── Public API ───

export async function validateRdCrmToken(token: string): Promise<{ valid: boolean; accountName?: string; userCount?: number; error?: string }> {
  try {
    const data = await rdFetch<any>("/users", token, { limit: "1" });
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
  const [contactsData, dealsData, orgsData, productsData, tasksData, pipelinesData, usersData, campaignsData, sourcesData, lossReasonsData, customFieldsData] = await Promise.all([
    rdFetch<any>("/contacts", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/deals", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/organizations", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/products", token, { limit: "1" }).catch(() => ({ total: 0, products: [] })),
    rdFetch<any>("/tasks", token, { limit: "1" }).catch(() => ({ total: 0 })),
    rdFetch<any>("/deal_pipelines", token, { limit: "200" }).catch(() => []),
    rdFetch<any>("/users", token, { limit: "200" }).catch(() => ({ users: [] })),
    rdFetch<any>("/campaigns", token, { limit: "1" }).catch(() => ({ total: 0, campaigns: [] })),
    rdFetch<any>("/deal_sources", token, { limit: "1" }).catch(() => ({ total: 0, deal_sources: [] })),
    rdFetch<any>("/deal_lost_reasons", token, { limit: "1" }).catch(() => ({ total: 0, deal_lost_reasons: [] })),
    rdFetch<any>("/custom_fields", token, { limit: "1" }).catch(() => ({ total: 0, custom_fields: [] })),
  ]);

  // Pipelines returns an array directly, not {total, deal_pipelines}
  const pipelinesCount = Array.isArray(pipelinesData) ? pipelinesData.length : (pipelinesData.total || (pipelinesData.deal_pipelines || []).length);
  const usersCount = (usersData.users || usersData || []).length;

  return {
    contacts: contactsData.total || 0,
    deals: dealsData.total || 0,
    organizations: orgsData.total || 0,
    products: productsData.total || (productsData.products || []).length,
    tasks: tasksData.total || 0,
    pipelines: pipelinesCount,
    users: usersCount,
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
  // Fetch deals per pipeline to avoid the 10,000 record limit
  // First, get all pipeline IDs
  const pipelines = await fetchAllPipelines(token);
  const pipelineIds = pipelines.map(p => p._id || p.id).filter(Boolean);

  console.log(`[RD Deals] Fetching deals from ${pipelineIds.length} pipelines...`);

  const allDeals: RdDeal[] = [];
  const seen = new Set<string>();
  let totalEstimate = 0;

  for (const pid of pipelineIds) {
    console.log(`[RD Deals] Fetching pipeline ${pid}...`);
    const pipelineDeals = await rdFetchAllPaginated<RdDeal>("/deals", token, "deals", { deal_pipeline_id: pid }, (fetched, total) => {
      if (onProgress) onProgress(allDeals.length + fetched, totalEstimate || total);
    });

    for (const deal of pipelineDeals) {
      const id = deal._id || deal.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        allDeals.push(deal);
      }
    }
    console.log(`[RD Deals] Pipeline ${pid}: ${pipelineDeals.length} deals, total unique so far: ${allDeals.length}`);
    totalEstimate = allDeals.length; // Update estimate
  }

  console.log(`[RD Deals] Total unique deals: ${allDeals.length}`);
  if (onProgress) onProgress(allDeals.length, allDeals.length);
  return allDeals;
}

export async function fetchAllOrganizations(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdOrganization[]> {
  return rdFetchAllPaginated<RdOrganization>("/organizations", token, "organizations", {}, onProgress);
}

export async function fetchAllProducts(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdProduct[]> {
  return rdFetchAllPaginated<RdProduct>("/products", token, "products", {}, onProgress);
}

export async function fetchAllTasks(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdTask[]> {
  // Fetch tasks by type to avoid the 10,000 record limit
  const taskTypes = ["call", "email", "meeting", "task", "whatsapp"];

  console.log(`[RD Tasks] Fetching tasks by type...`);

  const allTasks: RdTask[] = [];
  const seen = new Set<string>();
  let totalEstimate = 0;

  for (const type of taskTypes) {
    console.log(`[RD Tasks] Fetching type '${type}'...`);
    const typeTasks = await rdFetchAllPaginated<RdTask>("/tasks", token, "tasks", { type }, (fetched, total) => {
      if (onProgress) onProgress(allTasks.length + fetched, totalEstimate || total);
    });

    for (const task of typeTasks) {
      const id = task._id;
      if (id && !seen.has(id)) {
        seen.add(id);
        allTasks.push(task);
      }
    }
    console.log(`[RD Tasks] Type '${type}': ${typeTasks.length} tasks, total unique so far: ${allTasks.length}`);
    totalEstimate = allTasks.length;
  }

  console.log(`[RD Tasks] Total unique tasks: ${allTasks.length}`);
  if (onProgress) onProgress(allTasks.length, allTasks.length);
  return allTasks;
}

export async function fetchAllPipelines(token: string): Promise<RdPipeline[]> {
  // This endpoint returns an array directly, not {deal_pipelines: [...]}
  const data = await rdFetch<any>("/deal_pipelines", token, { limit: "200" });
  if (Array.isArray(data)) return data;
  return data.deal_pipelines || data || [];
}

export async function fetchAllUsers(token: string): Promise<RdUser[]> {
  const data = await rdFetch<any>("/users", token, { limit: "200" });
  return data.users || data || [];
}

export async function fetchAllCampaigns(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdCampaign[]> {
  return rdFetchAllPaginated<RdCampaign>("/campaigns", token, "campaigns", {}, onProgress);
}

export async function fetchAllSources(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdSource[]> {
  return rdFetchAllPaginated<RdSource>("/deal_sources", token, "deal_sources", {}, onProgress);
}

export async function fetchAllLossReasons(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdLossReason[]> {
  return rdFetchAllPaginated<RdLossReason>("/deal_lost_reasons", token, "deal_lost_reasons", {}, onProgress);
}

export async function fetchAllCustomFields(token: string, onProgress?: (fetched: number, total: number) => void): Promise<RdCustomField[]> {
  return rdFetchAllPaginated<RdCustomField>("/custom_fields", token, "custom_fields", {}, onProgress);
}
