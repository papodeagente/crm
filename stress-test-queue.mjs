/**
 * Stress Test — 50 webhook events burst
 * 
 * Confirms:
 * - No rate exceeded errors
 * - No webhook retries needed
 * - Queue absorbs burst
 * - Workers process jobs gradually
 */

import IORedis from "ioredis";

const SERVER_URL = "http://localhost:3000";
const REDIS_URL = "redis://localhost:6379";
const BURST_SIZE = 50;

function createWebhookPayload(index) {
  return {
    event: "messages.upsert",
    instance: "crm-150002-150001",
    data: {
      key: {
        remoteJid: `5511988880${String(index).padStart(3, "0")}@s.whatsapp.net`,
        fromMe: false,
        id: `STRESS_${Date.now()}_${index}`,
      },
      pushName: `Stress Contact ${index}`,
      message: {
        conversation: `Stress test message ${index}`,
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: "DELIVERY_ACK",
    },
    date_time: new Date().toISOString(),
    server_url: "https://evolution.test.com",
    apikey: "test-key",
  };
}

async function getQueueStats(redis) {
  const waiting = await redis.llen("bull:whatsapp-messages:wait").catch(() => 0);
  const active = await redis.llen("bull:whatsapp-messages:active").catch(() => 0);
  const completed = await redis.zcard("bull:whatsapp-messages:completed").catch(() => 0);
  const failed = await redis.zcard("bull:whatsapp-messages:failed").catch(() => 0);
  return { waiting, active, completed, failed };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  STRESS TEST — 50 WEBHOOK EVENTS BURST          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: 3 });
  await redis.ping();
  console.log("✅ Redis connected\n");

  // Flush previous test data
  await redis.flushdb();
  console.log("🧹 Redis flushed for clean test\n");

  // Wait for BullMQ to re-initialize
  await new Promise(r => setTimeout(r, 2000));

  const statsBefore = await getQueueStats(redis);
  console.log("📊 Queue stats BEFORE burst:");
  console.log(`   Waiting: ${statsBefore.waiting} | Active: ${statsBefore.active} | Completed: ${statsBefore.completed} | Failed: ${statsBefore.failed}\n`);

  // --- BURST: Send 50 webhooks as fast as possible ---
  console.log(`🚀 Sending ${BURST_SIZE} webhooks in rapid burst...\n`);
  
  const burstStart = performance.now();
  const results = [];
  const errors = [];

  // Send all 50 simultaneously (Promise.all)
  const promises = [];
  for (let i = 1; i <= BURST_SIZE; i++) {
    const payload = createWebhookPayload(i);
    const start = performance.now();
    promises.push(
      fetch(`${SERVER_URL}/api/webhooks/evolution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const elapsed = performance.now() - start;
          const body = await res.json();
          results.push({ status: res.status, body, latencyMs: elapsed, index: i });
        })
        .catch((err) => {
          errors.push({ index: i, error: err.message });
        })
    );
  }

  await Promise.all(promises);
  const burstElapsed = performance.now() - burstStart;

  // --- Analyze results ---
  console.log(`📨 Burst completed in ${burstElapsed.toFixed(2)}ms\n`);

  const queued = results.filter(r => r.body.queued === true);
  const inline = results.filter(r => !r.body.queued);
  const rateExceeded = results.filter(r => r.status === 429);
  const serverErrors = results.filter(r => r.status >= 500);
  const latencies = results.map(r => r.latencyMs);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)];
  const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
  const p99 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("BURST RESULTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`   Total sent:       ${BURST_SIZE}`);
  console.log(`   Successful:       ${results.length}`);
  console.log(`   Errors:           ${errors.length}`);
  console.log(`   Rate exceeded:    ${rateExceeded.length}`);
  console.log(`   Server errors:    ${serverErrors.length}`);
  console.log(`   Queued via Redis: ${queued.length}`);
  console.log(`   Processed inline: ${inline.length}`);
  console.log();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("LATENCY DISTRIBUTION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`   Min:    ${minLatency.toFixed(2)}ms`);
  console.log(`   Avg:    ${avgLatency.toFixed(2)}ms`);
  console.log(`   P50:    ${p50.toFixed(2)}ms`);
  console.log(`   P95:    ${p95.toFixed(2)}ms`);
  console.log(`   P99:    ${p99.toFixed(2)}ms`);
  console.log(`   Max:    ${maxLatency.toFixed(2)}ms`);
  console.log();

  if (errors.length > 0) {
    console.log("❌ ERRORS:");
    errors.forEach(e => console.log(`   #${e.index}: ${e.error}`));
    console.log();
  }

  // --- Monitor worker processing ---
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("WORKER PROCESSING TIMELINE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (let t = 0; t <= 30; t += 2) {
    const stats = await getQueueStats(redis);
    const total = stats.waiting + stats.active + stats.completed + stats.failed;
    const bar = "█".repeat(Math.round(stats.completed / 2)) + "░".repeat(Math.round((BURST_SIZE - stats.completed) / 2));
    console.log(`   T+${String(t).padStart(2, "0")}s | W:${String(stats.waiting).padStart(2)} A:${String(stats.active).padStart(2)} C:${String(stats.completed).padStart(2)} F:${String(stats.failed).padStart(2)} | [${bar}]`);
    
    if (stats.completed + stats.failed >= queued.length && stats.waiting === 0 && stats.active === 0) {
      console.log(`\n   ✅ All jobs processed at T+${t}s!\n`);
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  const statsFinal = await getQueueStats(redis);

  // --- FINAL SUMMARY ---
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  STRESS TEST FINAL SUMMARY                      ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   Rate exceeded errors:  ${rateExceeded.length === 0 ? "✅ NONE" : `❌ ${rateExceeded.length}`}`);
  console.log(`   Webhook retries:       ${errors.length === 0 ? "✅ NONE needed" : `❌ ${errors.length} failed`}`);
  console.log(`   Queue absorbed burst:  ${queued.length >= BURST_SIZE * 0.9 ? "✅ YES" : "⚠️ PARTIAL"} (${queued.length}/${BURST_SIZE})`);
  console.log(`   Workers processed:     ${statsFinal.completed >= queued.length ? "✅ ALL" : "⚠️ PARTIAL"} (${statsFinal.completed}/${queued.length})`);
  console.log(`   Failed jobs:           ${statsFinal.failed === 0 ? "✅ NONE" : `⚠️ ${statsFinal.failed}`}`);
  console.log(`   Avg webhook latency:   ${avgLatency.toFixed(2)}ms ${avgLatency < 50 ? "✅ < 50ms" : "⚠️ > 50ms"}`);
  console.log(`   P95 webhook latency:   ${p95.toFixed(2)}ms ${p95 < 100 ? "✅ < 100ms" : "⚠️ > 100ms"}`);
  console.log();

  await redis.quit();
}

main().catch(console.error);
