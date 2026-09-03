import { describe, expect, it } from "vitest";
import { simulateGraph } from "./engine";
import { createNodeSpec } from "./nodeSpecs";
import type { SimGraph, TrafficProfile } from "./types";

function chain(nodes: ReturnType<typeof createNodeSpec>[]): SimGraph {
  return {
    nodes,
    edges: nodes.slice(0, -1).map((n, i) => ({ id: `e${i}`, source: n.id, target: nodes[i + 1].id })),
  };
}

describe("cache node — hit ratio routing", () => {
  it("a 0.8 hit ratio cache drops database utilization from 0.95 to roughly 0.35", () => {
    const client = createNodeSpec("client", "client");
    const db = createNodeSpec("db", "database");
    const profile: TrafficProfile = {
      totalRps: 142.5,
      mix: { static: 0, read: 112.5 / 142.5, write: 30 / 142.5 },
    };

    const before = simulateGraph(chain([client, db]), profile);
    expect(before.nodeMetrics.db.utilization).toBeCloseTo(0.95, 2);

    const cache = createNodeSpec("cache", "cache", { config: { hitRatio: 0.8 } });
    const after = simulateGraph(chain([client, cache, db]), profile);
    expect(after.nodeMetrics.db.utilization).toBeCloseTo(0.35, 1);
  });

  it("absorbs exactly hitRatio of read traffic and forwards the rest", () => {
    const client = createNodeSpec("client", "client");
    const cache = createNodeSpec("cache", "cache", { config: { hitRatio: 0.8 } });
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 1, write: 0 } };

    const { nodeMetrics, terminal } = simulateGraph(chain([client, cache, db]), profile);

    expect(nodeMetrics.cache.incomingRps).toBeCloseTo(100);
    expect(nodeMetrics.db.incomingRps).toBeCloseTo(20);
    // All reads complete somewhere (80 hit at the cache, 20 miss through to the db).
    expect(terminal.read.rps).toBeCloseTo(100);
  });

  it("never absorbs write traffic — 100% of writes reach the database", () => {
    const client = createNodeSpec("client", "client");
    const cache = createNodeSpec("cache", "cache", { config: { hitRatio: 0.8 } });
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 0, write: 1 } };

    const { nodeMetrics } = simulateGraph(chain([client, cache, db]), profile);

    expect(nodeMetrics.db.incomingRps).toBeCloseTo(100);
  });

  it("never absorbs static traffic — it passes through untouched", () => {
    const client = createNodeSpec("client", "client");
    const cache = createNodeSpec("cache", "cache", { config: { hitRatio: 0.8 } });
    const sink = createNodeSpec("sink", "database", { capacityRps: 1000 });
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 1, read: 0, write: 0 } };

    const { nodeMetrics } = simulateGraph(chain([client, cache, sink]), profile);

    expect(nodeMetrics.cache.incomingRps).toBeCloseTo(0);
    expect(nodeMetrics.sink.incomingRps).toBeCloseTo(0);
  });

  it("caching a write-dominated workload barely moves the database's load", () => {
    const client = createNodeSpec("client", "client");
    const cache = createNodeSpec("cache", "cache", { config: { hitRatio: 0.8 } });
    const db = createNodeSpec("db", "database");
    const profile: TrafficProfile = { totalRps: 400, mix: { static: 0.05, read: 0.15, write: 0.8 } };

    const withoutCache = simulateGraph(chain([client, db]), profile);
    const withCache = simulateGraph(chain([client, cache, db]), profile);

    const reduction = 1 - withCache.nodeMetrics.db.incomingRps / withoutCache.nodeMetrics.db.incomingRps;
    expect(reduction).toBeLessThan(0.15);
  });
});
