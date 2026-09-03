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

describe("cdn node — static absorption", () => {
  it("absorbs 100% of static traffic and never reaches the app server", () => {
    const client = createNodeSpec("client", "client");
    const cdn = createNodeSpec("cdn", "cdn");
    const app = createNodeSpec("app", "app_server", { capacityRps: 1000 });
    const profile: TrafficProfile = { totalRps: 700, mix: { static: 0.7, read: 0.25, write: 0.05 } };

    const { nodeMetrics, terminal } = simulateGraph(chain([client, cdn, app]), profile);

    expect(nodeMetrics.cdn.incomingRps).toBeCloseTo(490);
    expect(terminal.static.rps).toBeCloseTo(490);
    // Only read+write reach the app server — static never does.
    expect(nodeMetrics.app.incomingRps).toBeCloseTo(210);
  });

  it("passes read and write through untouched, without adding its own latency", () => {
    const client = createNodeSpec("client", "client");
    const cdn = createNodeSpec("cdn", "cdn");
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 1, write: 0 } };

    const direct = simulateGraph(chain([client, db]), profile);
    const throughCdn = simulateGraph(chain([client, cdn, db]), profile);

    expect(throughCdn.terminal.read.avgLatencyMs).toBeCloseTo(direct.terminal.read.avgLatencyMs);
  });

  it("relieves an app server drowning in static traffic", () => {
    const client = createNodeSpec("client", "client");
    const app = createNodeSpec("app", "app_server", { capacityRps: 300 });
    const profile: TrafficProfile = { totalRps: 900, mix: { static: 0.7, read: 0.25, write: 0.05 } };

    const withoutCdn = simulateGraph(chain([client, app]), profile);
    expect(withoutCdn.nodeMetrics.app.utilization).toBeGreaterThan(1);

    const cdn = createNodeSpec("cdn", "cdn");
    const withCdn = simulateGraph(chain([client, cdn, app]), profile);
    expect(withCdn.nodeMetrics.app.utilization).toBeLessThan(1);
  });
});

describe("read_replica node — write rejection", () => {
  it("accepts read traffic like a database", () => {
    const client = createNodeSpec("client", "client");
    const replica = createNodeSpec("replica", "read_replica", { capacityRps: 1000 });
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 1, write: 0 } };

    const { nodeMetrics, terminal } = simulateGraph(chain([client, replica]), profile);

    expect(nodeMetrics.replica.incomingRps).toBeCloseTo(100);
    expect(terminal.read.rps).toBeCloseTo(100);
  });

  it("rejects write traffic at the edge — 100% error, never consumes capacity", () => {
    const client = createNodeSpec("client", "client");
    const replica = createNodeSpec("replica", "read_replica", { capacityRps: 1000 });
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 0, write: 1 } };

    const { nodeMetrics, errored, terminal } = simulateGraph(chain([client, replica]), profile);

    expect(errored.write).toBeCloseTo(100);
    expect(terminal.write.rps).toBeCloseTo(0);
    // Rejected before it ever counts against capacity.
    expect(nodeMetrics.replica.incomingRps).toBeCloseTo(0);
    expect(nodeMetrics.replica.errorRate).toBeCloseTo(1);
  });
});
