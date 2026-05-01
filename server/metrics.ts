/**
 * Métricas leves do CRM — counters + histograms in-memory com flush periódico
 * para o stdout no formato `[METRIC] key=value ...`.
 *
 * Objetivo: dar visibilidade do que está acontecendo no WhatsApp/Inbox sem
 * adicionar dependências externas (Prometheus, etc). Logs viram pipeline
 * de observabilidade — Coolify/CloudWatch agrega.
 *
 * USO:
 *   metric.inc("webhook_received", { event: "messages.upsert" });
 *   metric.timing("zapi_send_ms", elapsed);
 *   metric.inc("status_dropped", { reason: "monotonic" });
 *
 * Flush: a cada 60s, emite uma linha por métrica com agregação acumulada
 * desde o último flush. Depois zera os counters.
 */

type Tags = Record<string, string | number | boolean>;
type CounterKey = string; // "webhook_received|event=messages.upsert|session=crm-3-2"

interface HistogramBucket {
  count: number;
  sum: number;
  min: number;
  max: number;
}

const counters = new Map<CounterKey, number>();
const histograms = new Map<CounterKey, HistogramBucket>();
const FLUSH_INTERVAL_MS = 60_000;
let flushHandle: NodeJS.Timeout | null = null;

function makeKey(name: string, tags?: Tags): string {
  if (!tags) return name;
  const parts = Object.entries(tags)
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort();
  return `${name}|${parts.join("|")}`;
}

function parseKey(key: string): { name: string; tagsStr: string } {
  const idx = key.indexOf("|");
  if (idx < 0) return { name: key, tagsStr: "" };
  return {
    name: key.slice(0, idx),
    tagsStr: " " + key.slice(idx + 1).split("|").join(" "),
  };
}

export const metric = {
  /** Incrementa um counter. */
  inc(name: string, tags?: Tags, by = 1): void {
    const key = makeKey(name, tags);
    counters.set(key, (counters.get(key) ?? 0) + by);
  },

  /** Registra um valor numérico (latência, tamanho, etc). */
  timing(name: string, valueMs: number, tags?: Tags): void {
    const key = makeKey(name, tags);
    let h = histograms.get(key);
    if (!h) {
      h = { count: 0, sum: 0, min: valueMs, max: valueMs };
      histograms.set(key, h);
    }
    h.count++;
    h.sum += valueMs;
    if (valueMs < h.min) h.min = valueMs;
    if (valueMs > h.max) h.max = valueMs;
  },
};

function flush(): void {
  if (counters.size === 0 && histograms.size === 0) return;

  const now = new Date().toISOString();
  // Counters
  for (const [key, value] of counters.entries()) {
    const { name, tagsStr } = parseKey(key);
    console.log(`[METRIC] ${name}=${value}${tagsStr} ts=${now}`);
  }
  // Histograms
  for (const [key, h] of histograms.entries()) {
    const { name, tagsStr } = parseKey(key);
    const avg = h.count > 0 ? Math.round(h.sum / h.count) : 0;
    console.log(
      `[METRIC] ${name}_count=${h.count} ${name}_avg=${avg} ${name}_min=${h.min} ${name}_max=${h.max}${tagsStr} ts=${now}`,
    );
  }

  counters.clear();
  histograms.clear();
}

export function startMetricsFlush(): void {
  if (flushHandle) return;
  flushHandle = setInterval(flush, FLUSH_INTERVAL_MS);
  console.log(`[METRIC] flush iniciado (a cada ${FLUSH_INTERVAL_MS / 1000}s)`);
}

export function stopMetricsFlush(): void {
  if (flushHandle) {
    clearInterval(flushHandle);
    flushHandle = null;
  }
  flush(); // flush final
}

/** Snapshot pra debug/tests sem zerar. */
export function _snapshot(): { counters: Record<string, number>; histograms: Record<string, HistogramBucket> } {
  const c: Record<string, number> = {};
  const h: Record<string, HistogramBucket> = {};
  for (const [k, v] of counters) c[k] = v;
  for (const [k, v] of histograms) h[k] = { ...v };
  return { counters: c, histograms: h };
}
