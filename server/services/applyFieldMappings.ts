/**
 * applyFieldMappings — Aplica mapeamentos de campos RD Station → Entur OS custom fields.
 *
 * Chamado APÓS processInboundLead, sem alterar o fluxo principal.
 * Seguro: falhas aqui NÃO interrompem a importação.
 */
import { getDb, setCustomFieldValue } from "../db";
import { rdFieldMappings, customFields as customFieldsTable, contacts, deals, accounts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

interface ApplyFieldMappingsParams {
  tenantId: number;
  dealId?: number;
  contactId?: number;
  /** Dados brutos do lead RD Station (o objeto lead completo) */
  leadData: Record<string, any>;
  /** Campos cf_* já extraídos do payload */
  rdCustomFields?: Record<string, string>;
}

interface MappingResult {
  totalMappings: number;
  applied: number;
  skipped: number;
  errors: string[];
}

/**
 * Resolve o valor de um campo do RD Station a partir do payload do lead.
 * Busca em: top-level fields, custom_fields object, cf_* fields, last_conversion.content
 */
function resolveRdFieldValue(leadData: Record<string, any>, rdFieldKey: string, rdCustomFields?: Record<string, string>): string | null {
  // Build alternate keys: if key starts with cf_, also try without prefix; if not, also try with cf_ prefix
  const alternateKeys: string[] = [rdFieldKey];
  if (rdFieldKey.startsWith("cf_")) {
    alternateKeys.push(rdFieldKey.slice(3)); // "cf_utm_source" → "utm_source"
  } else {
    alternateKeys.push(`cf_${rdFieldKey}`); // "utm_source" → "cf_utm_source"
  }

  for (const key of alternateKeys) {
    // 1. Direto no rdCustomFields já extraídos (cf_* e custom_fields)
    if (rdCustomFields && rdCustomFields[key] !== undefined) {
      const v = String(rdCustomFields[key]);
      if (v.trim() !== "") return v;
    }

    // 2. Top-level field no lead (ex: "company", "job_title", "city", "state")
    if (leadData[key] !== undefined && leadData[key] !== null && String(leadData[key]).trim() !== "") {
      return String(leadData[key]);
    }

    // 3. Dentro de custom_fields object
    if (leadData.custom_fields && typeof leadData.custom_fields === "object") {
      const val = leadData.custom_fields[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
    }

    // 4. Dentro de last_conversion.content (form fields)
    const lastConversion = leadData.last_conversion || leadData.first_conversion;
    if (lastConversion?.content && typeof lastConversion.content === "object") {
      const val = lastConversion.content[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
    }

    // 5. Dentro de first_conversion.content.__cdp__original_event.payload (RD Station CDP events)
    const firstConversion = leadData.first_conversion;
    if (firstConversion?.content?.__cdp__original_event?.payload) {
      const cdpPayload = firstConversion.content.__cdp__original_event.payload;
      const val = cdpPayload[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
    }
  }

  return null;
}

/**
 * Resolve o accountId da deal para mapeamentos de empresa.
 * Se a deal não tem accountId, tenta criar/encontrar a account pelo company name.
 */
async function resolveAccountId(
  db: any,
  tenantId: number,
  dealId?: number,
  companyName?: string,
): Promise<number | null> {
  if (!dealId) return null;

  // Check if deal already has an accountId
  const [deal] = await db
    .select({ accountId: deals.accountId })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
    .limit(1);

  if (deal?.accountId) return deal.accountId;

  // No accountId on deal — try to find or create account from company name
  if (companyName && companyName.trim()) {
    const trimmedName = companyName.trim();

    // Try to find existing account with same name
    const [existingAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.name, trimmedName)))
      .limit(1);

    if (existingAccount) {
      // Link deal to existing account
      await db.update(deals).set({ accountId: existingAccount.id })
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
      return existingAccount.id;
    }

    // Create new account
    const [newAccount] = await db.insert(accounts).values({
      tenantId,
      name: trimmedName,
    }).$returningId();

    if (newAccount?.id) {
      // Link deal to new account
      await db.update(deals).set({ accountId: newAccount.id })
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
      return newAccount.id;
    }
  }

  return null;
}

export async function applyFieldMappings(params: ApplyFieldMappingsParams): Promise<MappingResult> {
  const { tenantId, dealId, contactId, leadData, rdCustomFields } = params;
  const result: MappingResult = { totalMappings: 0, applied: 0, skipped: 0, errors: [] };

  try {
    const db = await getDb();
    if (!db) {
      result.errors.push("Database não disponível");
      return result;
    }

    // 1. Buscar mapeamentos ativos para este tenant
    const mappings = await db
      .select()
      .from(rdFieldMappings)
      .where(and(
        eq(rdFieldMappings.tenantId, tenantId),
        eq(rdFieldMappings.isActive, true),
      ));

    result.totalMappings = mappings.length;
    if (mappings.length === 0) return result;

    // 2. Pré-carregar custom fields do tenant para validação
    const tenantCustomFields = await db
      .select()
      .from(customFieldsTable)
      .where(eq(customFieldsTable.tenantId, tenantId));

    const customFieldsMap = new Map(tenantCustomFields.map(f => [f.id, f]));

    // 3. Resolver accountId se necessário (para mapeamentos de empresa)
    const hasCompanyMappings = mappings.some(m => m.targetEntity === "company");
    let accountId: number | null = null;
    if (hasCompanyMappings) {
      const companyName = leadData.company || leadData.empresa || "";
      accountId = await resolveAccountId(db, tenantId, dealId, companyName);
    }

    // 4. Aplicar cada mapeamento
    for (const mapping of mappings) {
      try {
        // 4a. Resolver valor do campo RD
        const value = resolveRdFieldValue(leadData, mapping.rdFieldKey, rdCustomFields);
        if (value === null) {
          result.skipped++;
          continue; // Campo não veio no payload — ignorar silenciosamente
        }

        // 4b. Determinar entityType e entityId
        let entityType: string;
        let entityId: number | null = null;

        switch (mapping.targetEntity) {
          case "deal":
            entityType = "deal";
            entityId = dealId ?? null;
            break;
          case "contact":
            entityType = "contact";
            entityId = contactId ?? null;
            break;
          case "company":
            entityType = "company";
            entityId = accountId;
            break;
          default:
            result.skipped++;
            result.errors.push(`Mapeamento #${mapping.id}: targetEntity inválido "${mapping.targetEntity}"`);
            continue;
        }

        if (!entityId) {
          result.skipped++;
          continue; // Entidade não disponível (ex: deal não criada)
        }

        // 4c. Determinar campo de destino
        if (mapping.enturFieldType === "custom" && mapping.enturCustomFieldId) {
          // Validar que o custom field existe e pertence ao tenant
          const cf = customFieldsMap.get(mapping.enturCustomFieldId);
          if (!cf) {
            result.skipped++;
            result.errors.push(`Mapeamento #${mapping.id}: campo personalizado #${mapping.enturCustomFieldId} não encontrado`);
            continue;
          }

          // Gravar valor no custom field
          await setCustomFieldValue(tenantId, mapping.enturCustomFieldId, entityType, entityId, value);
          result.applied++;
          console.log(`[RD Field Mapping] Applied: "${mapping.rdFieldKey}" → custom field "${cf.label}" (${entityType} #${entityId}) = "${value.substring(0, 50)}"`);

        } else if (mapping.enturFieldType === "standard" && mapping.enturFieldKey) {
          // Campo padrão do sistema — aplicar via SQL direto
          await applyStandardFieldMapping(db, tenantId, mapping.enturFieldKey, entityType, entityId, value);
          result.applied++;
          console.log(`[RD Field Mapping] Applied: "${mapping.rdFieldKey}" → standard "${mapping.enturFieldKey}" (${entityType} #${entityId}) = "${value.substring(0, 50)}"`);

        } else {
          result.skipped++;
          result.errors.push(`Mapeamento #${mapping.id}: configuração incompleta (sem campo de destino)`);
        }

      } catch (mappingErr: any) {
        result.skipped++;
        result.errors.push(`Mapeamento #${mapping.id} ("${mapping.rdFieldKey}"): ${mappingErr.message}`);
        console.error(`[RD Field Mapping] Error applying mapping #${mapping.id}:`, mappingErr.message);
      }
    }

  } catch (err: any) {
    result.errors.push(`Erro geral: ${err.message}`);
    console.error(`[RD Field Mapping] General error:`, err.message);
  }

  if (result.applied > 0 || result.errors.length > 0) {
    console.log(`[RD Field Mapping] Resultado: ${result.applied} aplicados, ${result.skipped} ignorados, ${result.errors.length} erros de ${result.totalMappings} mapeamentos`);
  }

  return result;
}

/**
 * Aplica mapeamento para campos padrão do sistema (standard fields).
 * Suporta: contact.name, contact.email, contact.phone, account.name,
 *          deal.title, deal.valueCents, deal.utmSource, deal.utmMedium, etc.
 */
async function applyStandardFieldMapping(
  db: any,
  tenantId: number,
  enturFieldKey: string,
  entityType: string,
  entityId: number,
  value: string,
): Promise<void> {
  const [entity, field] = enturFieldKey.split(".");
  if (!entity || !field) return;

  // Map entity string to table and validate
  switch (entity) {
    case "contact":
      if (entityType !== "contact") return;
      const contactUpdates: Record<string, any> = {};
      switch (field) {
        case "name": contactUpdates.name = value; break;
        case "email": contactUpdates.email = value; break;
        case "phone": contactUpdates.phone = value; break;
        default: return;
      }
      await db.update(contacts).set(contactUpdates)
        .where(and(eq(contacts.id, entityId), eq(contacts.tenantId, tenantId)));
      break;

    case "account":
      if (entityType !== "company") return;
      const accountUpdates: Record<string, any> = {};
      switch (field) {
        case "name": accountUpdates.name = value; break;
        default: return;
      }
      await db.update(accounts).set(accountUpdates)
        .where(and(eq(accounts.id, entityId), eq(accounts.tenantId, tenantId)));
      break;

    case "deal":
      if (entityType !== "deal") return;
      const dealUpdates: Record<string, any> = {};
      switch (field) {
        case "title": dealUpdates.title = value; break;
        case "valueCents": {
          const parsed = parseInt(value.replace(/\D/g, ""), 10);
          if (!isNaN(parsed)) dealUpdates.valueCents = parsed;
          break;
        }
        case "utmSource": dealUpdates.utmSource = value; break;
        case "utmMedium": dealUpdates.utmMedium = value; break;
        case "utmCampaign": dealUpdates.utmCampaign = value; break;
        case "utmTerm": dealUpdates.utmTerm = value; break;
        case "utmContent": dealUpdates.utmContent = value; break;
        case "channelOrigin": dealUpdates.channelOrigin = value; break;
        case "leadSource": dealUpdates.leadSource = value; break;
        default: return;
      }
      await db.update(deals).set(dealUpdates)
        .where(and(eq(deals.id, entityId), eq(deals.tenantId, tenantId)));
      break;
  }
}
