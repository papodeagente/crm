/**
 * Helper compartilhado entre proposals e deals para resolver o customer Asaas.
 *
 * Cascata:
 *   1. Cache local (contacts.asaasCustomerId)
 *   2. Busca por CPF/CNPJ (contact.docId)
 *   3. Busca por e-mail (contact.email)
 *   4. Cria novo via createCustomer
 *
 * Sempre persiste o id resolvido em contacts.asaasCustomerId.
 */

import { TRPCError } from "@trpc/server";
import * as crm from "../crmDb";
import { AsaasError, type AsaasClient } from "./asaasService";

export type ContactInput = {
  id: number;
  name: string;
  email?: string | null;
  docId?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
  asaasCustomerId?: string | null;
};

export async function resolveAsaasCustomerForContact(
  tenantId: number,
  contact: ContactInput,
  client: AsaasClient,
): Promise<string> {
  if (!contact.name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Contato sem nome — preencha antes de gerar cobrança.",
    });
  }

  let customerId = contact.asaasCustomerId ?? null;

  if (!customerId && contact.docId) {
    try {
      const found = await client.findCustomerByCpfCnpj(contact.docId);
      if (found.data?.[0]) customerId = found.data[0].id;
    } catch {
      /* fall through */
    }
  }

  if (!customerId && contact.email) {
    try {
      const found = await client.findCustomerByEmail(contact.email);
      if (found.data?.[0]) customerId = found.data[0].id;
    } catch {
      /* fall through */
    }
  }

  if (!customerId) {
    try {
      const created = await client.createCustomer({
        name: contact.name,
        cpfCnpj: contact.docId || undefined,
        email: contact.email || undefined,
        mobilePhone: contact.phoneE164 || contact.phone || undefined,
        externalReference: `contact:${contact.id}`,
      });
      customerId = created.id;
    } catch (err: any) {
      const msg = err instanceof AsaasError ? err.message : err.message;
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Falha ao criar cliente no ASAAS: ${msg}`,
      });
    }
  }

  if (!customerId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Não foi possível resolver o cliente ASAAS.",
    });
  }

  // Persiste o cache se ainda não estava salvo
  if (contact.asaasCustomerId !== customerId) {
    await crm.setContactAsaasCustomerId(tenantId, contact.id, customerId);
  }

  return customerId;
}
