import { describe, expect, it } from "vitest";
import { simulateGraph } from "./engine";
import { createNodeSpec } from "./nodeSpecs";
import type { SimGraph, TrafficProfile } from "./types";

describe("edgeMetrics — per-edge rps for the particle layer", () => {
  it("reports rps flowing along a simple chain", () => {
    const graph: SimGraph = {
      nodes: [createNodeSpec("client", "client"), createNodeSpec("db", "database", { capacityRps: 1000 })],
      edges: [{ id: "e0", source: "client", target: "db" }],
    };
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 1, write: 0 } };

    const { edgeMetrics } = simulateGraph(graph, profile);

    expect(edgeMetrics.e0.rps).toBeCloseTo(100);
    expect(edgeMetrics.e0.byClass.read).toBeCloseTo(100);
    expect(edgeMetrics.e0.byClass.static).toBe(0);
  });

  it("splits evenly across a load balancer's fan-out edges", () => {
    const client = createNodeSpec("client", "client");
    const lb = createNodeSpec("lb", "load_balancer");
    const app1 = createNodeSpec("app1", "app_server", { capacityRps: 1000 });
    const app2 = createNodeSpec("app2", "app_server", { capacityRps: 1000 });
    const graph: SimGraph = {
      nodes: [client, lb, app1, app2],
      edges: [
        { id: "e0", source: "client", target: "lb" },
        { id: "e1", source: "lb", target: "app1" },
        { id: "e2", source: "lb", target: "app2" },
      ],
    };
    const profile: TrafficProfile = { totalRps: 200, mix: { static: 0, read: 1, write: 0 } };

    const { edgeMetrics } = simulateGraph(graph, profile);

    expect(edgeMetrics.e1.rps).toBeCloseTo(100);
    expect(edgeMetrics.e2.rps).toBeCloseTo(100);
  });

  it("shows a read_replica edge carrying only reads and the database edge only writes", () => {
    const client = createNodeSpec("client", "client");
    const app = createNodeSpec("app", "app_server", { capacityRps: 1000 });
    const replica = createNodeSpec("replica", "read_replica", { capacityRps: 1000 });
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const graph: SimGraph = {
      nodes: [client, app, replica, db],
      edges: [
        { id: "e0", source: "client", target: "app" },
        { id: "e-replica", source: "app", target: "replica" },
        { id: "e-db", source: "app", target: "db" },
      ],
    };
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 0.3, write: 0.7 } };

    const { edgeMetrics } = simulateGraph(graph, profile);

    expect(edgeMetrics["e-replica"].byClass.read).toBeCloseTo(30);
    expect(edgeMetrics["e-replica"].byClass.write).toBe(0);
    expect(edgeMetrics["e-db"].byClass.write).toBeCloseTo(70);
    expect(edgeMetrics["e-db"].byClass.read).toBe(0);
  });

  it("shows a cache's outbound edge carrying only the miss share of reads plus writes", () => {
    const client = createNodeSpec("client", "client");
    const cache = createNodeSpec("cache", "cache", { config: { hitRatio: 0.8 } });
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const graph: SimGraph = {
      nodes: [client, cache, db],
      edges: [
        { id: "e0", source: "client", target: "cache" },
        { id: "e1", source: "cache", target: "db" },
      ],
    };
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 1, write: 0 } };

    const { edgeMetrics } = simulateGraph(graph, profile);

    expect(edgeMetrics.e0.rps).toBeCloseTo(100);
    expect(edgeMetrics.e1.rps).toBeCloseTo(20); // only the 20% miss share continues on
  });
});
