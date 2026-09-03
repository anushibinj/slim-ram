import { describe, expect, it } from "vitest";
import { computeLatencyAndError } from "./engine";

describe("computeLatencyAndError", () => {
  it("returns base latency with no queueing at zero utilization", () => {
    const result = computeLatencyAndError(0, 150, 15);
    expect(result.utilization).toBe(0);
    expect(result.latencyMs).toBe(0);
    expect(result.errorRate).toBe(0);
  });

  it("keeps latency close to base latency at low utilization", () => {
    const result = computeLatencyAndError(15, 150, 15);
    expect(result.utilization).toBeCloseTo(0.1);
    expect(result.latencyMs).toBeCloseTo(15 / 0.9);
    expect(result.errorRate).toBe(0);
  });

  it("rises nonlinearly as utilization approaches capacity", () => {
    const at50 = computeLatencyAndError(75, 150, 15);
    const at90 = computeLatencyAndError(135, 150, 15);
    const at99 = computeLatencyAndError(148.5, 150, 15);

    expect(at50.latencyMs).toBeCloseTo(30);
    expect(at90.latencyMs).toBeCloseTo(150);
    expect(at99.latencyMs).toBeCloseTo(1500);

    // The curve must be convex (nonlinear): equal utilization steps produce
    // accelerating latency jumps, not a straight line.
    const step1 = at90.latencyMs - at50.latencyMs;
    const step2 = at99.latencyMs - at90.latencyMs;
    expect(step2).toBeGreaterThan(step1);
  });

  it("a database at 95% utilization sits at roughly 20x base latency", () => {
    const result = computeLatencyAndError(142.5, 150, 15);
    expect(result.utilization).toBeCloseTo(0.95);
    expect(result.latencyMs).toBeCloseTo(15 * 20, 0);
  });

  it("treats exactly u = 1 as saturated with zero error rate", () => {
    const result = computeLatencyAndError(150, 150, 15);
    expect(result.utilization).toBe(1);
    expect(result.errorRate).toBe(0);
    expect(result.latencyMs).toBe(15 * 100);
  });

  it("drops the overflow fraction of requests once saturated", () => {
    const result = computeLatencyAndError(300, 150, 15);
    expect(result.utilization).toBe(2);
    expect(result.errorRate).toBeCloseTo(0.5);
    expect(result.latencyMs).toBe(15 * 100);
  });

  it("clamps utilization before dividing so latency never becomes infinite", () => {
    const result = computeLatencyAndError(149.99, 150, 15);
    expect(Number.isFinite(result.latencyMs)).toBe(true);
    expect(result.latencyMs).toBeLessThanOrEqual(15 / (1 - 0.999));
  });

  it("reports zero utilization and latency when there is no traffic", () => {
    const result = computeLatencyAndError(0, 200, 20);
    expect(result).toEqual({ utilization: 0, latencyMs: 0, errorRate: 0 });
  });
});
