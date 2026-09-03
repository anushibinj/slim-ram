import { describe, expect, it } from "vitest";
import { simulateGraph } from "./engine";
import { computeGlobalMetrics } from "./metrics";
import { createNodeSpec } from "./nodeSpecs";
import type { SimGraph, TrafficProfile } from "./types";

function chain(nodes: ReturnType<typeof createNodeSpec>[]): SimGraph {
  return {
    nodes,
    edges: nodes.slice(0, -1).map((n, i) => ({ id: `e${i}`, source: n.id, target: nodes[i + 1].id })),
  };
}

describe("computeGlobalMetrics", () => {
  it("sums node costs into monthlyCost regardless of traffic", () => {
    const client = createNodeSpec("client", "client");
    const app = createNodeSpec("app", "app_server");
    const cache = createNodeSpec("cache", "cache");
    const db = createNodeSpec("db", "database");
    const graph = chain([client, app, cache, db]);
    const profile: TrafficProfile = { totalRps: 0, mix: { static: 0, read: 0, write: 0 } };

    const { terminal, errored } = simulateGraph(graph, profile);
    const global = computeGlobalMetrics(graph, terminal, errored, profile);

    expect(global.monthlyCost).toBe(0 + 20 + 15 + 80);
  });

  it("derives p99 as a fixed multiple of the weighted mean latency", () => {
    const client = createNodeSpec("client", "client");
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const graph = chain([client, db]);
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 0.5, write: 0.5 } };

    const { terminal, errored } = simulateGraph(graph, profile);
    const global = computeGlobalMetrics(graph, terminal, errored, profile);

    expect(global.p99LatencyMs).toBeCloseTo(global.meanLatencyMs * 2.5);
  });

  it("reports a collapsing p99 when a cache relieves a saturated database", () => {
    const client = createNodeSpec("client", "client");
    const db = createNodeSpec("db", "database");
    const profile: TrafficProfile = { totalRps: 142.5, mix: { static: 0, read: 112.5 / 142.5, write: 30 / 142.5 } };

    const before = simulateGraph(chain([client, db]), profile);
    const beforeGlobal = computeGlobalMetrics(chain([client, db]), before.terminal, before.errored, profile);

    const cache = createNodeSpec("cache", "cache", { config: { hitRatio: 0.8 } });
    const graphWithCache = chain([client, cache, db]);
    const after = simulateGraph(graphWithCache, profile);
    const afterGlobal = computeGlobalMetrics(graphWithCache, after.terminal, after.errored, profile);

    expect(afterGlobal.p99LatencyMs).toBeLessThan(beforeGlobal.p99LatencyMs);
  });

  it("reports zero errorRate for healthy traffic and a nonzero rate once a node saturates", () => {
    const client = createNodeSpec("client", "client");
    const healthyDb = createNodeSpec("db", "database", { capacityRps: 1000 });
    const healthyProfile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 1, write: 0 } };
    const healthyGraph = chain([client, healthyDb]);
    const healthy = simulateGraph(healthyGraph, healthyProfile);
    const healthyGlobal = computeGlobalMetrics(healthyGraph, healthy.terminal, healthy.errored, healthyProfile);
    expect(healthyGlobal.errorRate).toBe(0);

    const overloadedDb = createNodeSpec("db", "database");
    const overloadedProfile: TrafficProfile = { totalRps: 300, mix: { static: 0, read: 1, write: 0 } };
    const overloadedGraph = chain([client, overloadedDb]);
    const overloaded = simulateGraph(overloadedGraph, overloadedProfile);
    const overloadedGlobal = computeGlobalMetrics(overloadedGraph, overloaded.terminal, overloaded.errored, overloadedProfile);
    expect(overloadedGlobal.errorRate).toBeCloseTo(0.5);
  });

  it("reports latencyByClass per traffic class", () => {
    const client = createNodeSpec("client", "client");
    const cdn = createNodeSpec("cdn", "cdn");
    const app = createNodeSpec("app", "app_server", { capacityRps: 1000 });
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const graph = chain([client, cdn, app, db]);
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0.5, read: 0.5, write: 0 } };

    const { terminal, errored } = simulateGraph(graph, profile);
    const global = computeGlobalMetrics(graph, terminal, errored, profile);

    expect(global.latencyByClass.static).toBeGreaterThan(0);
    expect(global.latencyByClass.read).toBeGreaterThan(0);
    expect(global.latencyByClass.write).toBe(0);
  });
});
