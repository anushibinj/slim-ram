import { describe, expect, it } from "vitest";
import { simulateGraph } from "./engine";
import { createNodeSpec } from "./nodeSpecs";
import type { SimGraph, TrafficProfile } from "./types";

describe("app_server — config.serverCount", () => {
  it("defaults to a single instance", () => {
    const app = createNodeSpec("app", "app_server");
    expect(app.config.serverCount).toBe(1);
    expect(app.capacityRps).toBe(200);
  });

  it("multiplies effective capacity without needing extra wired node instances", () => {
    const client = createNodeSpec("client", "client");
    const graph = (serverCount: number): SimGraph => ({
      nodes: [client, createNodeSpec("app", "app_server", { config: { serverCount } })],
      edges: [{ id: "e0", source: "client", target: "app" }],
    });
    const profile: TrafficProfile = { totalRps: 900, mix: { static: 0.1, read: 0.85, write: 0.05 } };

    const one = simulateGraph(graph(1), profile);
    expect(one.nodeMetrics.app.utilization).toBeCloseTo(4.5);

    const five = simulateGraph(graph(5), profile);
    expect(five.nodeMetrics.app.utilization).toBeCloseTo(0.9);
    expect(five.nodeMetrics.app.errorRate).toBe(0);
  });
});
