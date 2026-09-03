import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createNodeSpec, tick } from "./index";
import type { SimGraph, TrafficProfile } from "./types";

describe("tick", () => {
  it("is a pure function: identical inputs produce identical output", () => {
    const graph: SimGraph = {
      nodes: [createNodeSpec("client", "client"), createNodeSpec("db", "database")],
      edges: [{ id: "e0", source: "client", target: "db" }],
    };
    const profile: TrafficProfile = { totalRps: 100, mix: { static: 0, read: 1, write: 0 } };

    const a = tick(graph, profile, 100);
    const b = tick(graph, profile, 100);

    expect(a).toEqual(b);
  });

  it("assembles per-node metrics and global metrics from a single graph + profile", () => {
    const graph: SimGraph = {
      nodes: [
        createNodeSpec("client", "client"),
        createNodeSpec("app", "app_server", { capacityRps: 1000 }),
        createNodeSpec("db", "database"),
      ],
      edges: [
        { id: "e0", source: "client", target: "app" },
        { id: "e1", source: "app", target: "db" },
      ],
    };
    const profile: TrafficProfile = { totalRps: 400, mix: { static: 0.1, read: 0.85, write: 0.05 } };

    const state = tick(graph, profile, 100);

    expect(Object.keys(state.nodes).sort()).toEqual(["app", "client", "db"]);
    expect(state.global.monthlyCost).toBeGreaterThan(0);
    expect(state.global.p99LatencyMs).toBeGreaterThan(0);
    expect(state.dt).toBe(100);
  });

  it("engine source files import zero React, DOM, or Zustand dependencies", () => {
    const files = globSync("src/sim/**/*.ts");
    expect(files.length).toBeGreaterThan(0);
    const forbidden = /from ["'](react|react-dom|zustand|@xyflow\/react)["']|document\.|window\./;
    for (const file of files) {
      const contents = readFileSync(file, "utf-8");
      expect(contents, `${file} must not depend on React/DOM/Zustand`).not.toMatch(forbidden);
    }
  });
});
