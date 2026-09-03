import { beforeEach, describe, expect, it } from "vitest";
import { createNodeSpec } from "../sim";
import { useGameStore } from "./gameStore";

const T0 = 1_000_000;

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.getState().loadLevel("level-01", T0);
  });

  it("starts on the briefing phase with the level's starting graph", () => {
    const s = useGameStore.getState();
    expect(s.phase).toBe("briefing");
    expect(s.level.id).toBe("level-01");
    expect(s.graph.nodes.map((n) => n.id)).toContain("database");
  });

  it("does not simulate while briefing is showing", () => {
    useGameStore.getState().stepSimulation(T0 + 100);
    expect(useGameStore.getState().phase).toBe("briefing");
  });

  it("moves to intro on dismiss, and locks editing for a few seconds", () => {
    useGameStore.getState().dismissBriefing(T0);
    expect(useGameStore.getState().phase).toBe("intro");

    useGameStore.getState().stepSimulation(T0 + 500);
    expect(useGameStore.getState().phase).toBe("intro");

    useGameStore.getState().stepSimulation(T0 + 4100);
    expect(useGameStore.getState().phase).toBe("editing");
  });

  it("throttles hud updates to roughly 4Hz instead of every 10Hz tick", () => {
    useGameStore.getState().dismissBriefing(T0);
    useGameStore.getState().stepSimulation(T0 + 4100); // now editing

    let t = T0 + 4100;
    for (let i = 0; i < 10; i++) {
      t += 100;
      useGameStore.getState().stepSimulation(t);
    }
    // 1000ms at 10Hz is 10 ticks, but hud samples are throttled to ~4Hz.
    const history = useGameStore.getState().p99History;
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history.length).toBeLessThanOrEqual(5);
  });

  it("requires the win condition to hold for 3 consecutive seconds before declaring a win", () => {
    // Wire in the level 1 fix: a cache between app_server and database.
    const store = useGameStore.getState();
    store.addNode(createNodeSpec("fix-cache", "cache"));
    store.removeEdge("e-app-db");
    store.addEdge({ id: "e-app-cache", source: "app_server", target: "fix-cache" });
    store.addEdge({ id: "e-cache-db", source: "fix-cache", target: "database" });

    useGameStore.getState().dismissBriefing(T0);
    useGameStore.getState().stepSimulation(T0 + 4100); // now editing, win condition already holds

    let t = T0 + 4100;
    for (let i = 0; i < 40; i++) {
      t += 100;
      useGameStore.getState().stepSimulation(t);
      if (useGameStore.getState().phase === "won") break;
    }

    expect(useGameStore.getState().phase).toBe("won");
    expect(t - (T0 + 4100)).toBeGreaterThanOrEqual(3000);
    expect(useGameStore.getState().completedLevelIds).toContain("level-01");
  });

  it("resets winHoldStartMs if the condition stops holding", () => {
    useGameStore.getState().dismissBriefing(T0);
    useGameStore.getState().stepSimulation(T0 + 4100); // editing, but still broken — condition never holds
    useGameStore.getState().stepSimulation(T0 + 4200);
    expect(useGameStore.getState().winHoldStartMs).toBeNull();
    expect(useGameStore.getState().phase).toBe("editing");
  });

  it("supports adding, removing, and reconfiguring graph nodes", () => {
    const store = useGameStore.getState();
    const cache = createNodeSpec("new-cache", "cache");
    store.addNode(cache);
    expect(useGameStore.getState().graph.nodes.some((n) => n.id === "new-cache")).toBe(true);

    store.updateNodeConfig("new-cache", { hitRatio: 0.5 });
    expect(useGameStore.getState().graph.nodes.find((n) => n.id === "new-cache")?.config.hitRatio).toBe(0.5);

    store.removeNode("new-cache");
    expect(useGameStore.getState().graph.nodes.some((n) => n.id === "new-cache")).toBe(false);
  });

  it("auto-lays-out new nodes, preserves manually dragged positions, and cleans up on removal", () => {
    const store = useGameStore.getState();
    const before = useGameStore.getState().positions;
    expect(before.database).toBeDefined();

    const cache = createNodeSpec("new-cache", "cache");
    store.addNode(cache);
    expect(useGameStore.getState().positions["new-cache"]).toBeDefined();

    store.setNodePosition("new-cache", { x: 999, y: 42 });
    expect(useGameStore.getState().positions["new-cache"]).toEqual({ x: 999, y: 42 });

    // Adding an unrelated node must not disturb the dragged one.
    store.addNode(createNodeSpec("another-cache", "cache"));
    expect(useGameStore.getState().positions["new-cache"]).toEqual({ x: 999, y: 42 });

    store.removeNode("new-cache");
    expect(useGameStore.getState().positions["new-cache"]).toBeUndefined();
  });

  it("tap-to-connect: tap source, then tap target, creates an edge", () => {
    const store = useGameStore.getState();
    store.addNode(createNodeSpec("new-cache", "cache"));

    store.beginConnect("app_server");
    expect(useGameStore.getState().connectSourceId).toBe("app_server");

    store.completeConnect("new-cache");
    expect(useGameStore.getState().connectSourceId).toBeNull();
    expect(useGameStore.getState().graph.edges).toContainEqual({
      id: "app_server->new-cache",
      source: "app_server",
      target: "new-cache",
    });
  });

  it("tap-to-connect: tapping the same node cancels instead of self-connecting", () => {
    const store = useGameStore.getState();
    store.beginConnect("app_server");
    store.completeConnect("app_server");
    expect(useGameStore.getState().connectSourceId).toBeNull();
    expect(useGameStore.getState().graph.edges.some((e) => e.source === e.target)).toBe(false);
  });
});
