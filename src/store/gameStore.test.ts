import { beforeEach, describe, expect, it } from "vitest";
import { createNodeSpec } from "../sim";
import { useGameStore } from "./gameStore";

const T0 = 1_000_000;

describe("gameStore", () => {
  beforeEach(() => {
    // completedLevelIds is meant to persist across loadLevel calls in real
    // play (it's cross-level progress) but that also means it leaks
    // between tests sharing this module-level store — reset it explicitly
    // so each test starts from a clean "nothing solved yet" baseline.
    useGameStore.setState({ completedLevelIds: [] });
    useGameStore.getState().loadLevel("level-01");
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

  it("moves straight to editing on dismiss, with no locked delay", () => {
    useGameStore.getState().dismissBriefing();
    expect(useGameStore.getState().phase).toBe("editing");

    // Immediately steppable — no artificial "watch it fail" window.
    useGameStore.getState().stepSimulation(T0 + 50);
    expect(useGameStore.getState().phase).toBe("editing");
  });

  it("throttles hud updates to roughly 4Hz instead of every 10Hz tick", () => {
    useGameStore.getState().dismissBriefing();

    let t = T0;
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

    useGameStore.getState().dismissBriefing(); // editing starts immediately, win condition already holds

    let t = T0;
    for (let i = 0; i < 40; i++) {
      t += 100;
      useGameStore.getState().stepSimulation(t);
      if (useGameStore.getState().winModalVisible) break;
    }

    expect(useGameStore.getState().winModalVisible).toBe(true);
    // Winning never locks the level — it should still be in editing phase.
    expect(useGameStore.getState().phase).toBe("editing");
    expect(t - T0).toBeGreaterThanOrEqual(3000);
    expect(useGameStore.getState().completedLevelIds).toContain("level-01");
  });

  it("does not lock editing or stop the sim loop after winning, and lets the player keep tinkering", () => {
    const store = useGameStore.getState();
    store.addNode(createNodeSpec("fix-cache", "cache"));
    store.removeEdge("e-app-db");
    store.addEdge({ id: "e-app-cache", source: "app_server", target: "fix-cache" });
    store.addEdge({ id: "e-cache-db", source: "fix-cache", target: "database" });

    useGameStore.getState().dismissBriefing();
    let t = T0;
    for (let i = 0; i < 40; i++) {
      t += 100;
      useGameStore.getState().stepSimulation(t);
      if (useGameStore.getState().winModalVisible) break;
    }
    expect(useGameStore.getState().winModalVisible).toBe(true);

    // Dismissing the win modal ("play around in this level") just hides
    // it — the level stays fully editable and completion is retained.
    store.dismissWinModal();
    expect(useGameStore.getState().winModalVisible).toBe(false);
    expect(useGameStore.getState().phase).toBe("editing");
    expect(useGameStore.getState().completedLevelIds).toContain("level-01");

    // Breaking the fix and simulating further must not crash or relock anything.
    store.removeNode("fix-cache");
    t += 100;
    useGameStore.getState().stepSimulation(t);
    expect(useGameStore.getState().phase).toBe("editing");
    expect(useGameStore.getState().completedLevelIds).toContain("level-01"); // still recorded as solved
  });

  it("does not re-show the win modal after breaking and re-fixing an already-solved level", () => {
    const store = useGameStore.getState();
    function wireFix() {
      store.addNode(createNodeSpec("fix-cache", "cache"));
      store.removeEdge("e-app-db");
      store.addEdge({ id: "e-app-cache", source: "app_server", target: "fix-cache" });
      store.addEdge({ id: "e-cache-db", source: "fix-cache", target: "database" });
    }

    wireFix();
    useGameStore.getState().dismissBriefing();
    let t = T0;
    for (let i = 0; i < 40; i++) {
      t += 100;
      useGameStore.getState().stepSimulation(t);
      if (useGameStore.getState().winModalVisible) break;
    }
    expect(useGameStore.getState().winModalVisible).toBe(true);
    store.dismissWinModal();

    // Break the fix — condition stops holding.
    store.removeNode("fix-cache");
    t += 100;
    useGameStore.getState().stepSimulation(t);
    expect(useGameStore.getState().winModalVisible).toBe(false);

    // Re-fix it exactly the same way and hold it for 3s again.
    wireFix();
    for (let i = 0; i < 40; i++) {
      t += 100;
      useGameStore.getState().stepSimulation(t);
    }

    // The level was already solved — re-satisfying the condition must not
    // pop the "you win" modal a second time.
    expect(useGameStore.getState().winModalVisible).toBe(false);
    expect(useGameStore.getState().completedLevelIds.filter((id) => id === "level-01")).toEqual(["level-01"]);
  });

  it("refreshes hud on the exact winning tick even if the throttle window hasn't elapsed", () => {
    const store = useGameStore.getState();
    store.addNode(createNodeSpec("fix-cache", "cache"));
    store.removeEdge("e-app-db");
    store.addEdge({ id: "e-app-cache", source: "app_server", target: "fix-cache" });
    store.addEdge({ id: "e-cache-db", source: "fix-cache", target: "database" });

    useGameStore.getState().dismissBriefing();
    useGameStore.getState().stepSimulation(T0); // first tick in editing — win condition already holds, starts the 3s hold

    // Drive right up to (but not past) the win threshold with a hud sample
    // freshly taken.
    useGameStore.getState().stepSimulation(T0 + 2950);
    expect(useGameStore.getState().phase).toBe("editing");
    const hudBefore = useGameStore.getState().hud;

    // Improve the cache's hit ratio right before the winning tick — still
    // holds the win condition, but p99 should now read noticeably lower.
    // If hud only refreshed on the throttled cadence, this tick (50ms
    // later, inside the 250ms window) would report the stale pre-tweak
    // value instead.
    store.updateNodeConfig("fix-cache", { hitRatio: 0.99 });
    useGameStore.getState().stepSimulation(T0 + 3000);

    expect(useGameStore.getState().winModalVisible).toBe(true);
    const hudAfter = useGameStore.getState().hud;
    expect(hudAfter.p99LatencyMs).toBeLessThan(hudBefore.p99LatencyMs);
  });

  it("resets winHoldStartMs if the condition stops holding", () => {
    useGameStore.getState().dismissBriefing();
    useGameStore.getState().stepSimulation(T0); // editing, but still broken — condition never holds
    useGameStore.getState().stepSimulation(T0 + 100);
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

  it("reveals hints one at a time, capped at the level's hint count, and resets on loadLevel", () => {
    const store = useGameStore.getState();
    const totalHints = useGameStore.getState().level.hints.length;
    expect(useGameStore.getState().hintsRevealed).toBe(0);

    store.revealNextHint();
    expect(useGameStore.getState().hintsRevealed).toBe(1);

    for (let i = 0; i < totalHints + 5; i++) store.revealNextHint();
    expect(useGameStore.getState().hintsRevealed).toBe(totalHints);

    useGameStore.getState().loadLevel("level-02");
    expect(useGameStore.getState().hintsRevealed).toBe(0);
  });
});
