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

describe("simulateGraph — linear chain traversal", () => {
  it("passes read/write through an app server to a saturated database", () => {
    const client = createNodeSpec("client", "client");
    const appServer = createNodeSpec("app", "app_server", { capacityRps: 1000 });
    const db = createNodeSpec("db", "database");
    const graph = chain([client, appServer, db]);

    const profile: TrafficProfile = { totalRps: 142.5, mix: { static: 0, read: 0.7894736842105263, write: 0.21052631578947367 } };

    const { nodeMetrics, terminal, errored } = simulateGraph(graph, profile);

    expect(nodeMetrics.db.incomingRps).toBeCloseTo(142.5);
    expect(nodeMetrics.db.utilization).toBeCloseTo(0.95);
    expect(errored.read + errored.write).toBeCloseTo(0);
    expect(terminal.read.rps + terminal.write.rps).toBeCloseTo(142.5);
  });

  it("has the app server absorb static traffic at 3x its base latency", () => {
    const client = createNodeSpec("client", "client");
    const appServer = createNodeSpec("app", "app_server", { capacityRps: 1000 });
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const graph = chain([client, appServer, db]);

    const profile: TrafficProfile = { totalRps: 100, mix: { static: 1, read: 0, write: 0 } };
    const { nodeMetrics, terminal } = simulateGraph(graph, profile);

    expect(nodeMetrics.app.incomingRps).toBeCloseTo(100);
    expect(nodeMetrics.db.incomingRps).toBeCloseTo(0);
    expect(terminal.static.rps).toBeCloseTo(100);
    expect(terminal.static.avgLatencyMs).toBeCloseTo(nodeMetrics.app.latencyMs * 3);
  });

  it("drops the overflow share of requests once a node saturates", () => {
    const client = createNodeSpec("client", "client");
    const appServer = createNodeSpec("app", "app_server");
    const db = createNodeSpec("db", "database", { capacityRps: 1000 });
    const graph = chain([client, appServer, db]);

    const profile: TrafficProfile = { totalRps: 400, mix: { static: 0.1, read: 0.85, write: 0.05 } };
    const { nodeMetrics, errored, terminal } = simulateGraph(graph, profile);

    expect(nodeMetrics.app.utilization).toBeCloseTo(2);
    expect(nodeMetrics.app.errorRate).toBeCloseTo(0.5);

    const totalErrored = errored.static + errored.read + errored.write;
    const totalTerminal = terminal.static.rps + terminal.read.rps + terminal.write.rps;
    expect(totalErrored).toBeCloseTo(200);
    expect(totalTerminal).toBeCloseTo(200);
  });

  it("counts traffic that reaches a dead end as errored instead of vanishing", () => {
    // client -> app_server, with nowhere for the app server to forward
    // read/write on to. A disconnected or incomplete graph must not report
    // clean zero-latency, zero-error traffic just because nothing was
    // there to measure it.
    const client = createNodeSpec("client", "client");
    const appServer = createNodeSpec("app", "app_server", { capacityRps: 1000 });
    const graph: SimGraph = {
      nodes: [client, appServer],
      edges: [{ id: "e0", source: "client", target: "app" }],
    };
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0.1, read: 0.7, write: 0.2 } };

    const { terminal, errored } = simulateGraph(graph, profile);

    // Static is absorbed by the app server itself, so it still completes.
    expect(terminal.static.rps).toBeCloseTo(10);
    // Read/write have nowhere to go — they must be counted as errors, not silently dropped.
    expect(errored.read).toBeCloseTo(70);
    expect(errored.write).toBeCloseTo(20);
    expect(terminal.read.rps).toBe(0);
    expect(terminal.write.rps).toBe(0);
  });

  it("reports 100% error rather than a trivial win when every downstream node is deleted", () => {
    const client = createNodeSpec("client", "client");
    const graph: SimGraph = { nodes: [client], edges: [] };
    const profile: TrafficProfile = { totalRps: 400, mix: { static: 0.1, read: 0.85, write: 0.05 } };

    const { terminal, errored } = simulateGraph(graph, profile);

    const totalTerminal = terminal.static.rps + terminal.read.rps + terminal.write.rps;
    const totalErrored = errored.static + errored.read + errored.write;
    expect(totalTerminal).toBe(0);
    expect(totalErrored).toBeCloseTo(400);
  });

  it("throws on a cyclic graph", () => {
    const a = createNodeSpec("a", "app_server");
    const b = createNodeSpec("b", "database");
    const graph: SimGraph = {
      nodes: [a, b],
      edges: [
        { id: "e0", source: "a", target: "b" },
        { id: "e1", source: "b", target: "a" },
      ],
    };
    expect(() => simulateGraph(graph, { totalRps: 10, mix: { static: 0, read: 1, write: 0 } })).toThrow();
  });
});
