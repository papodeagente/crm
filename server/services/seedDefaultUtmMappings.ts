/**
 * seedDefaultUtmMappings.ts
 * 
 * Provisiona os 5 mapeamentos UTM padrão para uma tenant.
 * Lógica 100% idempotente:
 *   - Verifica se cada mapeamento já existe (por rdFieldKey + enturFieldKey + tenantId)
 *   - Só cria os que estão faltando
 *   - Nunca sobrescreve mapeamentos existentes
 *   - Nunca duplica
 * 
 * Chamado em dois pontos:
 *   1. createTenant() → novas tenants já nascem com o padrão
 *   2. Script de migração one-time → tenants existentes recebem o padrão
 */

import { getDb } from "../db";
import { rdFieldMappings } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/** Os 5 mapeamentos UTM padrão do Entur OS */
const DEFAULT_UTM_MAPPINGS = [
  {
    rdFieldKey: "cf_utm_source",
    rdFieldLabel: "UTM Source",
    targetEntity: "deal" as const,
    enturFieldType: "standard" as const,
    enturFieldKey: "deal.utmSource",
  },
  {
    rdFieldKey: "cf_utm_medium",
    rdFieldLabel: "UTM Medium",
    targetEntity: "deal" as const,
    enturFieldType: "standard" as const,
    enturFieldKey: "deal.utmMedium",
  },
  {
    rdFieldKey: "cf_utm_campaign",
    rdFieldLabel: "UTM Campaign",
    targetEntity: "deal" as const,
    enturFieldType: "standard" as const,
    enturFieldKey: "deal.utmCampaign",
  },
  {
    rdFieldKey: "cf_utm_content",
    rdFieldLabel: "UTM Content",
    targetEntity: "deal" as const,
    enturFieldType: "standard" as const,
    enturFieldKey: "deal.utmContent",
  },
  {
    rdFieldKey: "cf_utm_term",
    rdFieldLabel: "UTM Term",
    targetEntity: "deal" as const,
    enturFieldType: "standard" as const,
    enturFieldKey: "deal.utmTerm",
  },
];

export { DEFAULT_UTM_MAPPINGS };

/**
 * Provisiona os 5 mapeamentos UTM padrão para uma tenant.
 * 
 * Regras de idempotência:
 * - Se já existe um mapeamento com o mesmo enturFieldKey para a tenant → SKIP
 * - Se já existe um mapeamento com o mesmo rdFieldKey para a tenant → SKIP
 * - Só cria os que estão genuinamente faltando
 * - Retorna { created: number, skipped: number, existing: string[] }
 */
export async function seedDefaultUtmMappings(tenantId: number): Promise<{
  created: number;
  skipped: number;
  existing: string[];
}> {
  const db = await getDb();
  if (!db) return { created: 0, skipped: 0, existing: [] };

  // Fetch all existing UTM-related mappings for this tenant in one query
  const existingMappings = await db
    .select({
      rdFieldKey: rdFieldMappings.rdFieldKey,
      enturFieldKey: rdFieldMappings.enturFieldKey,
    })
    .from(rdFieldMappings)
    .where(eq(rdFieldMappings.tenantId, tenantId));

  // Build sets for fast lookup
  const existingRdKeys = new Set(existingMappings.map((m: any) => m.rdFieldKey?.toLowerCase()));
  const existingEnturKeys = new Set(existingMappings.map((m: any) => m.enturFieldKey?.toLowerCase()));

  let created = 0;
  let skipped = 0;
  const existing: string[] = [];

  for (const mapping of DEFAULT_UTM_MAPPINGS) {
    // Check both directions to avoid any form of duplication
    const rdKeyExists = existingRdKeys.has(mapping.rdFieldKey.toLowerCase());
    const enturKeyExists = existingEnturKeys.has(mapping.enturFieldKey.toLowerCase());

    if (rdKeyExists || enturKeyExists) {
      skipped++;
      existing.push(mapping.enturFieldKey);
      continue;
    }

    // Create the mapping
    await db.insert(rdFieldMappings).values({
      tenantId,
      rdFieldKey: mapping.rdFieldKey,
      rdFieldLabel: mapping.rdFieldLabel,
      targetEntity: mapping.targetEntity,
      enturFieldType: mapping.enturFieldType,
      enturFieldKey: mapping.enturFieldKey,
      enturCustomFieldId: null,
      isActive: true,
    });

    created++;
  }

  console.log(
    `[UTM Seed] Tenant ${tenantId}: created=${created}, skipped=${skipped}` +
    (existing.length > 0 ? `, existing=[${existing.join(", ")}]` : "")
  );

  return { created, skipped, existing };
}

/**
 * Provisiona os 5 UTMs padrão para TODAS as tenants existentes.
 * Seguro para rodar múltiplas vezes (idempotente).
 * Retorna resumo global.
 */
export async function seedUtmMappingsForAllTenants(): Promise<{
  totalTenants: number;
  tenantsProvisioned: number;
  tenantsSkipped: number;
  totalCreated: number;
  totalSkipped: number;
  details: Array<{ tenantId: number; created: number; skipped: number }>;
}> {
  const db = await getDb();
  if (!db) return { totalTenants: 0, tenantsProvisioned: 0, tenantsSkipped: 0, totalCreated: 0, totalSkipped: 0, details: [] };

  // Get all tenant IDs
  const rows = await db.execute(sql`SELECT id FROM tenants ORDER BY id`);
  const tenantIds = (rows as unknown as any[])[0]?.map?.((r: any) => r.id) 
    ?? (rows as unknown as any[]).map((r: any) => r.id);

  let tenantsProvisioned = 0;
  let tenantsSkipped = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  const details: Array<{ tenantId: number; created: number; skipped: number }> = [];

  for (const tenantId of tenantIds) {
    const result = await seedDefaultUtmMappings(tenantId);
    details.push({ tenantId, created: result.created, skipped: result.skipped });
    totalCreated += result.created;
    totalSkipped += result.skipped;
    if (result.created > 0) tenantsProvisioned++;
    else tenantsSkipped++;
  }

  console.log(
    `[UTM Seed Global] ${tenantIds.length} tenants: ${tenantsProvisioned} provisioned, ${tenantsSkipped} already complete. ` +
    `Created ${totalCreated} mappings, skipped ${totalSkipped}.`
  );

  return {
    totalTenants: tenantIds.length,
    tenantsProvisioned,
    tenantsSkipped,
    totalCreated,
    totalSkipped,
    details,
  };
}
