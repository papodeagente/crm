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
// Totais cumulativos desde o boot — não zeram no flush. Servem ao endpoint
// /api/metrics (estilo Prometheus, que espera counters monotônicos).
const totalCounters = new Map<CounterKey, number>();
const totalHistograms = new Map<CounterKey, HistogramBucket>();
const bootedAt = new Date();
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

function bumpHistogram(map: Map<CounterKey, HistogramBucket>, key: string, valueMs: number): void {
  let h = map.get(key);
  if (!h) {
    h = { count: 0, sum: 0, min: valueMs, max: valueMs };
    map.set(key, h);
  }
  h.count++;
  h.sum += valueMs;
  if (valueMs < h.min) h.min = valueMs;
  if (valueMs > h.max) h.max = valueMs;
}

export const metric = {
  /** Incrementa um counter (atualiza window flush + total cumulativo). */
  inc(name: string, tags?: Tags, by = 1): void {
    const key = makeKey(name, tags);
    counters.set(key, (counters.get(key) ?? 0) + by);
    totalCounters.set(key, (totalCounters.get(key) ?? 0) + by);
  },

  /** Registra um valor numérico (latência, tamanho, etc). */
  timing(name: string, valueMs: number, tags?: Tags): void {
    const key = makeKey(name, tags);
    bumpHistogram(histograms, key, valueMs);
    bumpHistogram(totalHistograms, key, valueMs);
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

/** Reseta tudo (window + totais). Apenas para testes. */
export function _resetForTests(): void {
  counters.clear();
  histograms.clear();
  totalCounters.clear();
  totalHistograms.clear();
}

/** Snapshot pra debug/tests sem zerar (window de 60s). */
export function _snapshot(): { counters: Record<string, number>; histograms: Record<string, HistogramBucket> } {
  const c: Record<string, number> = {};
  const h: Record<string, HistogramBucket> = {};
  for (const [k, v] of counters) c[k] = v;
  for (const [k, v] of histograms) h[k] = { ...v };
  return { counters: c, histograms: h };
}

/** Snapshot dos totais cumulativos (não zera). Pra endpoint HTTP estilo Prometheus. */
export function _totalSnapshot(): {
  counters: Record<string, number>;
  histograms: Record<string, HistogramBucket>;
  bootedAt: string;
} {
  const c: Record<string, number> = {};
  const h: Record<string, HistogramBucket> = {};
  for (const [k, v] of totalCounters) c[k] = v;
  for (const [k, v] of totalHistograms) h[k] = { ...v };
  return { counters: c, histograms: h, bootedAt: bootedAt.toISOString() };
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function keyToPromLabels(key: string): { name: string; labels: string } {
  const idx = key.indexOf("|");
  if (idx < 0) return { name: key, labels: "" };
  const name = key.slice(0, idx);
  const pairs = key
    .slice(idx + 1)
    .split("|")
    .map(p => {
      const eq = p.indexOf("=");
      if (eq < 0) return null;
      const k = p.slice(0, eq);
      const v = p.slice(eq + 1);
      return `${k}="${escapeLabelValue(v)}"`;
    })
    .filter(Boolean) as string[];
  return { name, labels: pairs.length ? `{${pairs.join(",")}}` : "" };
}

/** Renderiza totais no formato text/plain do Prometheus exposition. */
export function renderPrometheus(): string {
  const lines: string[] = [];
  const seenCounter = new Set<string>();
  for (const [k, v] of totalCounters) {
    const { name, labels } = keyToPromLabels(k);
    if (!seenCounter.has(name)) {
      lines.push(`# TYPE ${name} counter`);
      seenCounter.add(name);
    }
    lines.push(`${name}${labels} ${v}`);
  }

  const seenSummary = new Set<string>();
  for (const [k, h] of totalHistograms) {
    const { name, labels } = keyToPromLabels(k);
    if (!seenSummary.has(name)) {
      lines.push(`# TYPE ${name}_count counter`);
      lines.push(`# TYPE ${name}_sum counter`);
      lines.push(`# TYPE ${name}_min gauge`);
      lines.push(`# TYPE ${name}_max gauge`);
      seenSummary.add(name);
    }
    lines.push(`${name}_count${labels} ${h.count}`);
    lines.push(`${name}_sum${labels} ${h.sum}`);
    lines.push(`${name}_min${labels} ${h.min}`);
    lines.push(`${name}_max${labels} ${h.max}`);
  }

  // Heartbeat + uptime pra confirmar que o endpoint tá vivo
  lines.push(`# TYPE crm_metrics_uptime_seconds gauge`);
  lines.push(`crm_metrics_uptime_seconds ${Math.floor((Date.now() - bootedAt.getTime()) / 1000)}`);

  return lines.join("\n") + "\n";
}
