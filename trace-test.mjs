#!/usr/bin/env node
/**
 * TRACE TEST: Simulate a realistic Evolution API webhook message
 * and collect all [TRACE] logs from the server to measure pipeline latency.
 */

const SERVER_URL = "http://localhost:3000";

async function sendWebhookMessage(testId) {
  const msgId = `TRACE_TEST_${testId}_${Date.now()}`;
  const remoteJid = "5511999990001@s.whatsapp.net";
  
  const payload = {
    event: "messages.upsert",
    instance: "crm-150002-150001",
    data: {
      key: {
        remoteJid,
        fromMe: false,
        id: msgId,
      },
      pushName: "Trace Test User",
      message: {
        conversation: `Test message ${testId} at ${new Date().toISOString()}`,
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
    destination: SERVER_URL,
    date_time: new Date().toISOString(),
    sender: remoteJid,
    server_url: "https://evolution.example.com",
    apikey: "test",
  };

  const sendTime = Date.now();
  console.log(`\n[TEST] Sending webhook at ${sendTime} | msgId: ${msgId}`);
  
  const res = await fetch(`${SERVER_URL}/api/webhooks/evolution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  const responseTime = Date.now();
  const body = await res.json();
  console.log(`[TEST] Webhook response: ${res.status} in ${responseTime - sendTime}ms | queued: ${body.queued || false}`);
  
  return { msgId, sendTime, responseTime, status: res.status, queued: body.queued };
}

async function collectServerLogs(msgId, waitMs = 3000) {
  console.log(`[TEST] Waiting ${waitMs}ms for worker to process...`);
  await new Promise(r => setTimeout(r, waitMs));
  
  // Read devserver log for TRACE lines matching this msgId
  const { execSync } = await import("child_process");
  const logs = execSync(
    `grep "\\[TRACE\\]" /home/ubuntu/whatsapp-automation-app/.manus-logs/devserver.log | grep "${msgId}" | tail -30`,
    { encoding: "utf-8" }
  ).trim();
  
  return logs;
}

async function collectBrowserLogs(msgId) {
  const { execSync } = await import("child_process");
  try {
    const logs = execSync(
      `grep "\\[TRACE\\]" /home/ubuntu/whatsapp-automation-app/.manus-logs/browserConsole.log | grep "${msgId}" | tail -20`,
      { encoding: "utf-8" }
    ).trim();
    return logs;
  } catch {
    return "(no browser trace logs found — browser may not be on inbox page)";
  }
}

function parseTraceLogs(logs) {
  const stages = [];
  for (const line of logs.split("\n")) {
    const stageMatch = line.match(/\[TRACE\]\[(\w+)\]/);
    const tsMatch = line.match(/timestamp: (\d+)/);
    const deltaMatch = line.match(/delta(?:_from_\w+)?: (\d+|N\/A)ms/);
    if (stageMatch && tsMatch) {
      stages.push({
        stage: stageMatch[1],
        timestamp: parseInt(tsMatch[1]),
        delta: deltaMatch ? deltaMatch[1] : "N/A",
        raw: line.trim(),
      });
    }
  }
  return stages;
}

async function runTest() {
  console.log("=" .repeat(80));
  console.log("PIPELINE LATENCY TRACE TEST");
  console.log("=" .repeat(80));
  
  // Test 1: Single message
  console.log("\n--- TEST 1: Single Message ---");
  const t1 = await sendWebhookMessage("SINGLE");
  const serverLogs1 = await collectServerLogs(t1.msgId, 3000);
  const browserLogs1 = await collectBrowserLogs(t1.msgId);
  
  console.log("\n[SERVER TRACE LOGS]");
  console.log(serverLogs1 || "(no trace logs found)");
  
  console.log("\n[BROWSER TRACE LOGS]");
  console.log(browserLogs1);
  
  const stages1 = parseTraceLogs(serverLogs1);
  if (stages1.length > 0) {
    console.log("\n[PARSED STAGES]");
    const firstTs = stages1[0].timestamp;
    for (const s of stages1) {
      console.log(`  ${s.stage.padEnd(25)} | +${(s.timestamp - firstTs).toString().padStart(5)}ms | delta: ${s.delta}ms`);
    }
    const lastTs = stages1[stages1.length - 1].timestamp;
    console.log(`\n  TOTAL BACKEND PIPELINE: ${lastTs - firstTs}ms`);
    console.log(`  WEBHOOK RESPONSE TIME: ${t1.responseTime - t1.sendTime}ms`);
  }
  
  // Test 2: Burst of 5 messages
  console.log("\n\n--- TEST 2: Burst of 5 Messages ---");
  const burstResults = [];
  const burstStart = Date.now();
  for (let i = 0; i < 5; i++) {
    burstResults.push(sendWebhookMessage(`BURST_${i}`));
  }
  const burstResponses = await Promise.all(burstResults);
  const burstResponseEnd = Date.now();
  console.log(`[TEST] All 5 webhooks responded in ${burstResponseEnd - burstStart}ms`);
  
  // Wait for all workers to process
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("\n[BURST SERVER TRACE LOGS]");
  for (const br of burstResponses) {
    const logs = await collectServerLogs(br.msgId, 0);
    const stages = parseTraceLogs(logs);
    if (stages.length > 0) {
      const firstTs = stages[0].timestamp;
      const lastTs = stages[stages.length - 1].timestamp;
      console.log(`  ${br.msgId.substring(0, 30)} | webhook→socket: ${lastTs - firstTs}ms | webhook_response: ${br.responseTime - br.sendTime}ms`);
    } else {
      console.log(`  ${br.msgId.substring(0, 30)} | (no trace logs — may be dedup or session not found)`);
    }
  }
  
  // Summary
  console.log("\n" + "=" .repeat(80));
  console.log("SUMMARY");
  console.log("=" .repeat(80));
  console.log(`Test 1 (single): webhook response ${t1.responseTime - t1.sendTime}ms, queued: ${t1.queued}`);
  console.log(`Test 2 (burst 5): all responded in ${burstResponseEnd - burstStart}ms`);
  
  // Check for any 429 or rate limit errors
  const { execSync } = await import("child_process");
  try {
    const rateLimitLogs = execSync(
      `grep -i "429\\|rate.exceed\\|Rate limit" /home/ubuntu/whatsapp-automation-app/.manus-logs/devserver.log | tail -5`,
      { encoding: "utf-8" }
    ).trim();
    if (rateLimitLogs) {
      console.log("\n[RATE LIMIT ERRORS FOUND]");
      console.log(rateLimitLogs);
    } else {
      console.log("\n[NO RATE LIMIT ERRORS]");
    }
  } catch {
    console.log("\n[NO RATE LIMIT ERRORS]");
  }
}

runTest().catch(console.error);
