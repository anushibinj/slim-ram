import { describe, expect, it } from "vitest";
import { createNodeSpec, tick } from "../sim";
import type { SimGraph } from "../sim";
import { LEVELS, getLevelById, getNextLevelId } from "./index";
import type { Level, WinCondition } from "./types";

function wins(level: Level, graph: SimGraph): boolean {
  const state = tick(graph, level.trafficProfile, 100);
  const c: WinCondition = level.winCondition;
  if (c.maxP99Ms !== undefined && state.global.p99LatencyMs > c.maxP99Ms) return false;
  if (c.maxErrorRate !== undefined && state.global.errorRate > c.maxErrorRate) return false;
  if (c.maxMonthlyCost !== undefined && state.global.monthlyCost > c.maxMonthlyCost) return false;
  return true;
}

function addNode(graph: SimGraph, node: ReturnType<typeof createNodeSpec>): SimGraph {
  return { nodes: [...graph.nodes, node], edges: graph.edges };
}

function addEdge(graph: SimGraph, source: string, target: string): SimGraph {
  return { nodes: graph.nodes, edges: [...graph.edges, { id: `${source}->${target}`, source, target }] };
}

function removeEdge(graph: SimGraph, source: string, target: string): SimGraph {
  return { nodes: graph.nodes, edges: graph.edges.filter((e) => !(e.source === source && e.target === target)) };
}

describe("levels registry", () => {
  it("has exactly five levels in order", () => {
    expect(LEVELS).toHaveLength(5);
    expect(LEVELS.map((l) => l.id)).toEqual(["level-01", "level-02", "level-03", "level-04", "level-05"]);
  });

  it("getLevelById / getNextLevelId traverse the sequence", () => {
    expect(getLevelById("level-03")?.title).toBe(LEVELS[2].title);
    expect(getNextLevelId("level-01")).toBe("level-02");
    expect(getNextLevelId("level-05")).toBeUndefined();
    expect(getLevelById("nope")).toBeUndefined();
  });

  it("every level's allowed node types are used somewhere in the game", () => {
    const known = new Set(["client", "app_server", "database", "cache", "load_balancer", "cdn", "read_replica"]);
    for (const level of LEVELS) {
      for (const t of level.allowedNodeTypes) expect(known.has(t)).toBe(true);
    }
  });

  it("every level has at least 3 non-empty hints, progressively revealed", () => {
    for (const level of LEVELS) {
      expect(level.hints.length).toBeGreaterThanOrEqual(3);
      for (const hint of level.hints) {
        expect(hint.trim().length).toBeGreaterThan(0);
      }
      // Hints must be distinct — no accidental duplicate/copy-paste entries.
      expect(new Set(level.hints).size).toBe(level.hints.length);
    }
  });
});

describe("level-01 — the database is on fire", () => {
  const level = LEVELS[0];

  it("is broken before the player touches it", () => {
    expect(wins(level, level.startingGraph)).toBe(false);
  });

  it("is won by inserting a cache between the app server and the database", () => {
    const cache = createNodeSpec("fix-cache", "cache");
    let fixed = addNode(level.startingGraph, cache);
    fixed = removeEdge(fixed, "app_server", "database");
    fixed = addEdge(fixed, "app_server", cache.id);
    fixed = addEdge(fixed, cache.id, "database");
    expect(wins(level, fixed)).toBe(true);
  });
});

describe("level-02 — the app server is the bottleneck now", () => {
  const level = LEVELS[1];

  it("is broken before the player touches it", () => {
    expect(wins(level, level.startingGraph)).toBe(false);
  });

  it("is won by scaling the app server's serverCount behind the same topology", () => {
    const scaled: SimGraph = {
      nodes: level.startingGraph.nodes.map((n) => (n.id === "app_server" ? { ...n, config: { serverCount: 5 } } : n)),
      edges: level.startingGraph.edges,
    };
    expect(wins(level, scaled)).toBe(true);
  });

  it("is won by fanning out to multiple app servers behind a load balancer", () => {
    const lb = createNodeSpec("lb", "load_balancer");
    const apps = [1, 2, 3, 4, 5].map((n) => createNodeSpec(`app${n}`, "app_server"));
    let fixed: SimGraph = { nodes: [...level.startingGraph.nodes, lb, ...apps], edges: level.startingGraph.edges };
    fixed = removeEdge(fixed, "client", "app_server");
    fixed = addEdge(fixed, "client", lb.id);
    for (const app of apps) {
      fixed = addEdge(fixed, lb.id, app.id);
      fixed = addEdge(fixed, app.id, "cache");
    }
    expect(wins(level, fixed)).toBe(true);
  });
});

describe("level-03 — static assets are eating the app servers", () => {
  const level = LEVELS[2];

  it("is broken before the player touches it", () => {
    expect(wins(level, level.startingGraph)).toBe(false);
  });

  it("is won by inserting a cdn in front of the app server", () => {
    const cdn = createNodeSpec("cdn", "cdn");
    let fixed = addNode(level.startingGraph, cdn);
    fixed = removeEdge(fixed, "client", "app_server");
    fixed = addEdge(fixed, "client", cdn.id);
    fixed = addEdge(fixed, cdn.id, "app_server");
    expect(wins(level, fixed)).toBe(true);
  });
});

describe("level-04 — do it on a budget", () => {
  const level = LEVELS[3];

  it("is broken before the player touches it", () => {
    expect(wins(level, level.startingGraph)).toBe(false);
  });

  it("is NOT won by the naive raw-capacity fix — it works but blows the budget", () => {
    const lb = createNodeSpec("lb", "load_balancer");
    const apps = [1, 2, 3].map((n) => createNodeSpec(`app${n}`, "app_server"));
    let naive: SimGraph = { nodes: [...level.startingGraph.nodes, lb, ...apps], edges: level.startingGraph.edges };
    naive = removeEdge(naive, "client", "app_server");
    naive = addEdge(naive, "client", lb.id);
    for (const app of apps) {
      naive = addEdge(naive, lb.id, app.id);
      naive = addEdge(naive, app.id, "database");
    }
    const state = tick(naive, level.trafficProfile, 100);
    expect(state.global.errorRate).toBeLessThan(0.05); // the fix does work technically...
    expect(state.global.monthlyCost).toBeGreaterThan(level.budgetCap!); // ...but costs too much
    expect(wins(level, naive)).toBe(false);
  });

  it("is won by the cheap, high-leverage cdn fix, and stays under budget", () => {
    const cdn = createNodeSpec("cdn", "cdn");
    let fixed = addNode(level.startingGraph, cdn);
    fixed = removeEdge(fixed, "client", "app_server");
    fixed = addEdge(fixed, "client", cdn.id);
    fixed = addEdge(fixed, cdn.id, "app_server");
    const state = tick(fixed, level.trafficProfile, 100);
    expect(state.global.monthlyCost).toBeLessThanOrEqual(level.budgetCap!);
    expect(wins(level, fixed)).toBe(true);
  });
});

describe("level-05 — caching will not save you", () => {
  const level = LEVELS[4];

  it("is broken before the player touches it", () => {
    expect(wins(level, level.startingGraph)).toBe(false);
  });

  it("cannot be won by adding a cache — write-dominated traffic barely moves", () => {
    const cache = createNodeSpec("fix-cache", "cache");
    let withCache = addNode(level.startingGraph, cache);
    withCache = removeEdge(withCache, "app_server", "database");
    withCache = addEdge(withCache, "app_server", cache.id);
    withCache = addEdge(withCache, cache.id, "database");
    expect(wins(level, withCache)).toBe(false);
  });

  it("is won by routing reads to a read_replica, leaving writes on the primary database", () => {
    const replica = createNodeSpec("replica", "read_replica");
    let fixed = addNode(level.startingGraph, replica);
    fixed = addEdge(fixed, "app_server", replica.id);
    expect(wins(level, fixed)).toBe(true);
  });
});
