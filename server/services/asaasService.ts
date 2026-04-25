/**
 * ASAAS API v3 client.
 * Docs: https://docs.asaas.com/reference/comece-por-aqui
 *
 * Per-tenant: each clinic connects their own ASAAS account.
 * Sandbox: https://sandbox.asaas.com/api/v3
 * Production: https://api.asaas.com/v3
 */

const PROD_BASE = "https://api.asaas.com/v3";
const SANDBOX_BASE = "https://sandbox.asaas.com/api/v3";

export type AsaasBillingType =
  | "BOLETO"
  | "CREDIT_CARD"
  | "PIX"
  | "UNDEFINED";

export interface AsaasClientOptions {
  apiKey: string;
  sandbox?: boolean;
  /** Override base URL (for tests). */
  baseUrl?: string;
  /** Idempotency key for write operations. */
  idempotencyKey?: string;
}

export interface AsaasAccount {
  email: string;
  name: string;
  walletId?: string;
  apiVersion?: string;
  companyType?: string;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  notificationDisabled?: boolean;
  externalReference?: string;
}

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  status: string;
  value: number;
  netValue?: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  /** Direct payment link (when billingType=UNDEFINED). */
  pixQrCodeUrl?: string;
}

export interface AsaasPaymentInput {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  postalService?: boolean;
  installmentCount?: number;
  installmentValue?: number;
}

export class AsaasError extends Error {
  status: number;
  code?: string;
  errors?: any[];
  constructor(message: string, status: number, errors?: any[], code?: string) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

export function createAsaasClient(opts: AsaasClientOptions) {
  const baseUrl = opts.baseUrl || (opts.sandbox ? SANDBOX_BASE : PROD_BASE);

  async function request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      "access_token": opts.apiKey,
      "Content-Type": "application/json",
      "User-Agent": "Clinilucro/1.0",
      ...extraHeaders,
    };
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }

    if (!res.ok) {
      const errors = json?.errors || [{ description: text || res.statusText }];
      const description = errors[0]?.description || `ASAAS ${res.status}`;
      const code = errors[0]?.code;
      throw new AsaasError(description, res.status, errors, code);
    }
    return json as T;
  }

  return {
    /** Validates the API key by fetching account info. */
    getCurrentAccount(): Promise<AsaasAccount> {
      return request<AsaasAccount>("GET", "/myAccount");
    },

    findCustomerByCpfCnpj(cpfCnpj: string): Promise<{ data: AsaasCustomer[] }> {
      const sanitized = cpfCnpj.replace(/\D/g, "");
      return request<{ data: AsaasCustomer[] }>("GET", `/customers?cpfCnpj=${encodeURIComponent(sanitized)}`);
    },

    findCustomerByEmail(email: string): Promise<{ data: AsaasCustomer[] }> {
      return request<{ data: AsaasCustomer[] }>("GET", `/customers?email=${encodeURIComponent(email)}`);
    },

    createCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
      return request<AsaasCustomer>("POST", "/customers", input);
    },

    getCustomer(customerId: string): Promise<AsaasCustomer> {
      return request<AsaasCustomer>("GET", `/customers/${customerId}`);
    },

    createPayment(input: AsaasPaymentInput): Promise<AsaasPayment> {
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["asaas-idempotency-key"] = opts.idempotencyKey;
      return request<AsaasPayment>("POST", "/payments", input, headers);
    },

    getPayment(paymentId: string): Promise<AsaasPayment> {
      return request<AsaasPayment>("GET", `/payments/${paymentId}`);
    },

    deletePayment(paymentId: string): Promise<{ deleted: boolean; id: string }> {
      return request<{ deleted: boolean; id: string }>("DELETE", `/payments/${paymentId}`);
    },
  };
}

export type AsaasClient = ReturnType<typeof createAsaasClient>;
