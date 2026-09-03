import { describe, expect, it } from "vitest";
import { simulateGraph } from "./engine";
import { createNodeSpec } from "./nodeSpecs";
import type { SimGraph, TrafficProfile } from "./types";

describe("load balancer node — even fan-out", () => {
  it("splits all incoming traffic evenly across every outbound edge", () => {
    const client = createNodeSpec("client", "client");
    const lb = createNodeSpec("lb", "load_balancer");
    const app1 = createNodeSpec("app1", "app_server", { capacityRps: 1000 });
    const app2 = createNodeSpec("app2", "app_server", { capacityRps: 1000 });
    const app3 = createNodeSpec("app3", "app_server", { capacityRps: 1000 });

    const graph: SimGraph = {
      nodes: [client, lb, app1, app2, app3],
      edges: [
        { id: "e0", source: "client", target: "lb" },
        { id: "e1", source: "lb", target: "app1" },
        { id: "e2", source: "lb", target: "app2" },
        { id: "e3", source: "lb", target: "app3" },
      ],
    };
    const profile: TrafficProfile = { totalRps: 900, mix: { static: 0.1, read: 0.85, write: 0.05 } };

    const { nodeMetrics } = simulateGraph(graph, profile);

    expect(nodeMetrics.lb.incomingRps).toBeCloseTo(900);
    expect(nodeMetrics.app1.incomingRps).toBeCloseTo(300);
    expect(nodeMetrics.app2.incomingRps).toBeCloseTo(300);
    expect(nodeMetrics.app3.incomingRps).toBeCloseTo(300);
  });

  it("relieves a saturated single app server by scaling out behind a load balancer", () => {
    const client = createNodeSpec("client", "client");
    const lonelyApp = createNodeSpec("app", "app_server");
    const soloProfile: TrafficProfile = { totalRps: 900, mix: { static: 0.1, read: 0.85, write: 0.05 } };
    const solo = simulateGraph(
      { nodes: [client, lonelyApp], edges: [{ id: "e0", source: "client", target: "app" }] },
      soloProfile,
    );
    expect(solo.nodeMetrics.app.utilization).toBeGreaterThan(1);

    const lb = createNodeSpec("lb", "load_balancer");
    const apps = [1, 2, 3, 4, 5].map((n) => createNodeSpec(`app${n}`, "app_server"));
    const scaled = simulateGraph(
      {
        nodes: [client, lb, ...apps],
        edges: [
          { id: "e0", source: "client", target: "lb" },
          ...apps.map((a, i) => ({ id: `e${i + 1}`, source: "lb", target: a.id })),
        ],
      },
      soloProfile,
    );
    expect(scaled.nodeMetrics.app1.utilization).toBeLessThan(1);
    expect(scaled.nodeMetrics.app1.errorRate).toBe(0);
  });
});
