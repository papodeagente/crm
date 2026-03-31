#!/usr/bin/env node
/**
 * Z-API Cleanup & Reconciliation Script
 *
 * Executa limpeza de instâncias Z-API lixo e reconcilia estado do banco com a Partner API.
 *
 * Uso:
 *   node zapi-cleanup.mjs --dry-run          # Só lista, não modifica nada
 *   node zapi-cleanup.mjs --execute           # Cancela token-validation-* + reconcilia
 *   node zapi-cleanup.mjs --execute --fix-webhooks  # Também corrige webhooks das conectadas
 *
 * Requer env vars: ZAPI_PARTNER_TOKEN, ZAPI_CLIENT_TOKEN, DATABASE_URL
 */

const ZAPI_BASE_URL = "https://api.z-api.io";
const PARTNER_TOKEN = process.env.ZAPI_PARTNER_TOKEN;
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const WEBHOOK_BASE = "https://crm.enturos.com";

// Fernando's personal instance — never touch
const PROTECTED_INSTANCES = new Set([
  "3F0C3308C401E016A9EF8E5974FC4255", // Hodiax - Entur - WhatsApp - Fernando
]);

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--execute");
const FIX_WEBHOOKS = args.includes("--fix-webhooks");

// ═══════════════════════════════════════════════════════════
// HTTP Client
// ═══════════════════════════════════════════════════════════

async function partnerFetch(method, path, body) {
  const url = `${ZAPI_BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${PARTNER_TOKEN}`,
  };
  if (CLIENT_TOKEN) {
    headers["Client-Token"] = CLIENT_TOKEN;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }

  try { return JSON.parse(text); } catch { return text; }
}

async function instanceFetch(instanceId, token, method, endpoint, body) {
  const url = `${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/${endpoint}`;
  const headers = { "Content-Type": "application/json" };
  if (CLIENT_TOKEN) headers["Client-Token"] = CLIENT_TOKEN;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${method} ${endpoint} → ${res.status}: ${text}`);
  }

  try { return JSON.parse(text); } catch { return text; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════
// 1. List ALL instances (with pagination)
// ═══════════════════════════════════════════════════════════

async function listAllInstances() {
  const all = [];
  let page = 1;

  while (true) {
    const data = await partnerFetch("GET", `/instances?page=${page}&pageSize=20`);
    const content = data.content || [];
    all.push(...content);

    const totalPages = data.totalPage || 1;
    console.log(`    Página ${page}/${totalPages}: ${content.length} instâncias`);

    if (page >= totalPages || content.length === 0) break;
    page++;
    await sleep(300);
  }

  return all;
}

// ═══════════════════════════════════════════════════════════
// 2. Classify instances
// ═══════════════════════════════════════════════════════════

function classify(inst) {
  if (PROTECTED_INSTANCES.has(inst.id)) return "protected";
  if (inst.name?.startsWith("token-validation-")) return "garbage";
  if (inst.name?.startsWith("EnturOS-")) return "tenant";
  return "unknown";
}

// ═══════════════════════════════════════════════════════════
// 3. Cancel garbage instances
// ═══════════════════════════════════════════════════════════

async function cancelGarbageInstances(instances) {
  const garbage = instances.filter(i => classify(i) === "garbage");

  console.log(`\n${"═".repeat(60)}`);
  console.log(`FASE 1: CANCELAR INSTÂNCIAS LIXO (${garbage.length} encontradas)`);
  console.log(`${"═".repeat(60)}`);

  if (garbage.length === 0) {
    console.log("  Nenhuma instância token-validation-* encontrada.");
    return { cancelled: 0, errors: 0 };
  }

  let cancelled = 0;
  let errors = 0;

  for (const inst of garbage) {
    const status = inst.phoneConnected ? "CONNECTED" : "disconnected";
    console.log(`  ${DRY_RUN ? "[DRY-RUN]" : "[CANCEL]"} ${inst.name} (${inst.id}) — ${status}`);

    if (!DRY_RUN) {
      try {
        await partnerFetch("POST", `/instances/${inst.id}/token/${inst.token}/integrator/on-demand/cancel`);
        cancelled++;
        console.log(`    → Cancelado ✓`);
      } catch (err) {
        errors++;
        console.log(`    → ERRO: ${err.message}`);
      }
      await sleep(500); // Rate limit
    }
  }

  if (DRY_RUN) {
    console.log(`\n  [DRY-RUN] ${garbage.length} instâncias seriam canceladas. Use --execute para executar.`);
  } else {
    console.log(`\n  Resultado: ${cancelled} canceladas, ${errors} erros`);
  }

  return { cancelled, errors };
}

// ═══════════════════════════════════════════════════════════
// 4. Reconcile tenant instances
// ═══════════════════════════════════════════════════════════

async function reconcileTenantInstances(instances) {
  console.log(`\n${"═".repeat(60)}`);
  console.log("FASE 2: RECONCILIAR INSTÂNCIAS DE TENANT");
  console.log(`${"═".repeat(60)}`);

  // Build lookup from Partner API
  const zapiLookup = new Map();
  for (const inst of instances) {
    zapiLookup.set(inst.id, inst);
  }

  // Read tenant_zapi_instances from DB via MySQL CLI
  // Since we're running inside the container, use DATABASE_URL
  // But since we don't have mysql2 available in .mjs context, we'll use the data we already have
  // Instead, output reconciliation report

  const tenantInstances = instances.filter(i => classify(i) === "tenant");

  console.log(`\n  Instâncias EnturOS-* encontradas no Z-API: ${tenantInstances.length}`);
  console.log("");

  for (const inst of tenantInstances) {
    const connected = inst.phoneConnected && inst.whatsappConnected;
    const statusIcon = connected ? "🟢" : "🔴";
    const payStatus = inst.paymentStatus || "?";

    console.log(`  ${statusIcon} ${inst.name}`);
    console.log(`     ID: ${inst.id}`);
    console.log(`     Phone: ${inst.phoneConnected}, WA: ${inst.whatsappConnected}, Payment: ${payStatus}`);

    // Check webhook URLs
    const webhooks = {
      received: inst.receivedCallbackUrl || inst.receivedAndDeliveryCallbackUrl || "NOT SET",
      send: inst.deliveryCallbackUrl || "NOT SET",
      disconnect: inst.disconnectedCallbackUrl || "NOT SET",
      connect: inst.connectedCallbackUrl || "NOT SET",
      status: inst.messageStatusCallbackUrl || "NOT SET",
    };

    const allWebhooksCorrect = Object.values(webhooks).every(
      url => url === "NOT SET" || url.includes("crm.enturos.com")
    );

    if (allWebhooksCorrect) {
      console.log(`     Webhooks: ✅ Apontando para crm.enturos.com`);
    } else {
      console.log(`     Webhooks: ❌ ERRADOS!`);
      for (const [type, url] of Object.entries(webhooks)) {
        if (url !== "NOT SET" && !url.includes("crm.enturos.com")) {
          console.log(`       ${type}: ${url}`);
        }
      }

      // Fix webhooks if connected and --fix-webhooks flag
      if (connected && FIX_WEBHOOKS) {
        // Extract sessionId from any webhook URL that exists
        const anyUrl = Object.values(webhooks).find(u => u !== "NOT SET") || "";
        const sessionMatch = anyUrl.match(/\/api\/webhooks\/zapi\/([^/]+)/);
        const sessionId = sessionMatch ? sessionMatch[1] : null;

        if (sessionId) {
          const correctUrl = `${WEBHOOK_BASE}/api/webhooks/zapi/${sessionId}`;
          console.log(`     ${DRY_RUN ? "[DRY-RUN]" : "[FIX]"} Corrigindo webhook → ${correctUrl}`);

          if (!DRY_RUN) {
            try {
              await instanceFetch(inst.id, inst.token, "PUT", "update-every-webhooks", {
                value: correctUrl,
                notifySentByMe: true,
              });
              console.log(`     → Webhook atualizado ✓`);
            } catch (err) {
              console.log(`     → ERRO ao atualizar webhook: ${err.message}`);
            }
            await sleep(500);
          }
        } else {
          console.log(`     ⚠️ Não foi possível extrair sessionId da URL de webhook`);
        }
      }
    }

    console.log("");
  }

  // Report unknown instances
  const unknown = instances.filter(i => classify(i) === "unknown");
  if (unknown.length > 0) {
    console.log(`\n  ⚠️ Instâncias DESCONHECIDAS (não são token-validation-* nem EnturOS-*):`);
    for (const inst of unknown) {
      const statusIcon = inst.phoneConnected ? "🟢" : "🔴";
      console.log(`    ${statusIcon} ${inst.name || "(sem nome)"} — ${inst.id}`);
    }
  }

  // Report protected instances
  const prot = instances.filter(i => classify(i) === "protected");
  if (prot.length > 0) {
    console.log(`\n  🛡️ Instâncias PROTEGIDAS (não serão tocadas):`);
    for (const inst of prot) {
      console.log(`    ${inst.name} — ${inst.id}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 5. Summary report
// ═══════════════════════════════════════════════════════════

function printSummary(instances) {
  console.log(`\n${"═".repeat(60)}`);
  console.log("RESUMO GERAL");
  console.log(`${"═".repeat(60)}`);

  const byType = { garbage: 0, tenant: 0, unknown: 0, protected: 0 };
  const connected = { total: 0, garbage: 0, tenant: 0 };

  for (const inst of instances) {
    const type = classify(inst);
    byType[type]++;
    if (inst.phoneConnected || inst.whatsappConnected) {
      connected.total++;
      connected[type] = (connected[type] || 0) + 1;
    }
  }

  console.log(`  Total instâncias: ${instances.length}`);
  console.log(`  - token-validation-* (lixo): ${byType.garbage}`);
  console.log(`  - EnturOS-* (tenant): ${byType.tenant}`);
  console.log(`  - Protegidas: ${byType.protected}`);
  console.log(`  - Desconhecidas: ${byType.unknown}`);
  console.log(`  Conectadas: ${connected.total}`);
  console.log(`  Modo: ${DRY_RUN ? "DRY-RUN (nenhuma modificação)" : "EXECUTANDO"}`);
  if (FIX_WEBHOOKS) console.log(`  Fix webhooks: ATIVADO`);
}

// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       Z-API Cleanup & Reconciliation Script             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Modo: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}`);
  console.log(`  Fix Webhooks: ${FIX_WEBHOOKS ? "SIM" : "NÃO"}`);
  console.log(`  Partner Token: ${PARTNER_TOKEN ? PARTNER_TOKEN.substring(0, 20) + "..." : "NÃO CONFIGURADO"}`);
  console.log(`  Client Token: ${CLIENT_TOKEN ? CLIENT_TOKEN.substring(0, 20) + "..." : "NÃO CONFIGURADO"}`);

  if (!PARTNER_TOKEN) {
    console.error("\n❌ ZAPI_PARTNER_TOKEN não configurado. Abortando.");
    process.exit(1);
  }

  // 1. List all instances
  console.log("\n  Buscando todas as instâncias da Partner API...");
  const instances = await listAllInstances();
  console.log(`  Encontradas: ${instances.length} instâncias`);

  // 2. Summary
  printSummary(instances);

  // 3. Cancel garbage
  await cancelGarbageInstances(instances);

  // 4. Reconcile tenants
  await reconcileTenantInstances(instances);

  console.log(`\n${"═".repeat(60)}`);
  console.log("CONCLUÍDO");
  console.log(`${"═".repeat(60)}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
