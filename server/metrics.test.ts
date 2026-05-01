import { describe, expect, it, beforeEach, vi } from "vitest";
import { metric, _snapshot, stopMetricsFlush } from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    // Limpa o estado entre testes (flush final + clear)
    stopMetricsFlush();
    // Snapshot zero
    const snap = _snapshot();
    expect(Object.keys(snap.counters).length).toBe(0);
    expect(Object.keys(snap.histograms).length).toBe(0);
  });

  it("inc agrega counters por tags", () => {
    metric.inc("test_event", { kind: "a" });
    metric.inc("test_event", { kind: "a" });
    metric.inc("test_event", { kind: "b" });
    const snap = _snapshot();
    expect(snap.counters["test_event|kind=a"]).toBe(2);
    expect(snap.counters["test_event|kind=b"]).toBe(1);
  });

  it("inc com `by` permite incremento custom", () => {
    metric.inc("bytes", undefined, 1024);
    metric.inc("bytes", undefined, 512);
    const snap = _snapshot();
    expect(snap.counters["bytes"]).toBe(1536);
  });

  it("timing acumula count/sum/min/max", () => {
    metric.timing("latency_ms", 100, { endpoint: "send-text" });
    metric.timing("latency_ms", 200, { endpoint: "send-text" });
    metric.timing("latency_ms", 50, { endpoint: "send-text" });
    const snap = _snapshot();
    const h = snap.histograms["latency_ms|endpoint=send-text"];
    expect(h.count).toBe(3);
    expect(h.sum).toBe(350);
    expect(h.min).toBe(50);
    expect(h.max).toBe(200);
  });

  it("flush emite linhas [METRIC] e zera o estado", () => {
    metric.inc("foo", { x: "1" }, 5);
    metric.timing("bar_ms", 42);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    stopMetricsFlush(); // chama flush no fim
    const calls = logSpy.mock.calls.map((c) => String(c[0]));
    logSpy.mockRestore();

    expect(calls.some((c) => c.startsWith("[METRIC] foo=5") && c.includes("x=1"))).toBe(true);
    expect(calls.some((c) => c.includes("bar_ms_count=1") && c.includes("bar_ms_avg=42"))).toBe(true);

    // Pós-flush deve estar vazio
    const after = _snapshot();
    expect(Object.keys(after.counters).length).toBe(0);
    expect(Object.keys(after.histograms).length).toBe(0);
  });

  it("tags ordenadas por key (chave estável independente da ordem)", () => {
    metric.inc("evt", { b: "2", a: "1" });
    metric.inc("evt", { a: "1", b: "2" });
    const snap = _snapshot();
    // Mesma chave canônica
    expect(snap.counters["evt|a=1|b=2"]).toBe(2);
  });
});
