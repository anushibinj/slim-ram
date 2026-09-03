import { create } from "zustand";
import { getLevelById, LEVELS } from "../levels";
import type { Level } from "../levels";
import { tick } from "../sim";
import type { EdgeSpec, NodeSpec, SimGraph, SimState } from "../sim";
import { loadProgress, saveProgress } from "./storage";

export const SIM_TICK_MS = 100; // fixed 10Hz, per the engine's performance contract
const HUD_THROTTLE_MS = 250; // ~4Hz — the only cadence React HUD components should see
const INTRO_LOCK_MS = 4000; // the broken system runs live, untouchable, before editing unlocks
const WIN_HOLD_MS = 3000; // win condition must hold for 3 consecutive seconds
const P99_HISTORY_WINDOW_MS = 30_000;

export type GamePhase = "briefing" | "intro" | "editing" | "won";

export interface HudSnapshot {
  p99LatencyMs: number;
  meanLatencyMs: number;
  errorRate: number;
  monthlyCost: number;
}

export interface P99Sample {
  t: number;
  p99: number;
}

function emptyHud(): HudSnapshot {
  return { p99LatencyMs: 0, meanLatencyMs: 0, errorRate: 0, monthlyCost: 0 };
}

export function evaluateWinCondition(level: Level, state: SimState): boolean {
  const c = level.winCondition;
  if (c.maxP99Ms !== undefined && state.global.p99LatencyMs > c.maxP99Ms) return false;
  if (c.maxErrorRate !== undefined && state.global.errorRate > c.maxErrorRate) return false;
  if (c.maxMonthlyCost !== undefined && state.global.monthlyCost > c.maxMonthlyCost) return false;
  return true;
}

interface GameStoreState {
  level: Level;
  graph: SimGraph;
  /**
   * Written at 10Hz. Do NOT select this reactively from a React component —
   * read it imperatively via `useGameStore.getState().simState` from the
   * rAF loop / particle layer instead, or you'll re-render at 10Hz.
   */
  simState: SimState;
  /** Throttled to ~4Hz. Safe — this is the one slice of sim output meant for reactive React rendering. */
  hud: HudSnapshot;
  p99History: P99Sample[];
  phase: GamePhase;
  introStartMs: number | null;
  winHoldStartMs: number | null;
  completedLevelIds: string[];

  loadLevel: (levelId: string, nowMs?: number) => void;
  dismissBriefing: (nowMs: number) => void;
  stepSimulation: (nowMs: number) => void;

  addNode: (node: NodeSpec) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: EdgeSpec) => void;
  removeEdge: (edgeId: string) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, number>) => void;
}

const initialLevel = LEVELS[0];
const progress = loadProgress(initialLevel.id);

export const useGameStore = create<GameStoreState>((set, get) => ({
  level: initialLevel,
  graph: initialLevel.startingGraph,
  simState: tick(initialLevel.startingGraph, initialLevel.trafficProfile, 0),
  hud: emptyHud(),
  p99History: [],
  phase: "briefing",
  introStartMs: null,
  winHoldStartMs: null,
  completedLevelIds: progress.completedLevelIds,

  loadLevel: (levelId, nowMs) => {
    const level = getLevelById(levelId);
    if (!level) return;
    set({
      level,
      graph: level.startingGraph,
      simState: tick(level.startingGraph, level.trafficProfile, 0),
      hud: emptyHud(),
      p99History: [],
      phase: "briefing",
      introStartMs: nowMs ?? null,
      winHoldStartMs: null,
    });
  },

  dismissBriefing: (nowMs) => {
    if (get().phase !== "briefing") return;
    set({ phase: "intro", introStartMs: nowMs });
  },

  stepSimulation: (nowMs) => {
    const state = get();
    if (state.phase === "briefing" || state.phase === "won") return;

    const simState = tick(state.graph, state.level.trafficProfile, SIM_TICK_MS);

    let phase: GamePhase = state.phase;
    if (phase === "intro" && state.introStartMs !== null && nowMs - state.introStartMs >= INTRO_LOCK_MS) {
      phase = "editing";
    }

    let winHoldStartMs = state.winHoldStartMs;
    if (phase === "editing") {
      const holds = evaluateWinCondition(state.level, simState);
      if (holds) {
        if (winHoldStartMs === null) winHoldStartMs = nowMs;
        if (nowMs - winHoldStartMs >= WIN_HOLD_MS) {
          phase = "won";
          const completedLevelIds = state.completedLevelIds.includes(state.level.id)
            ? state.completedLevelIds
            : [...state.completedLevelIds, state.level.id];
          saveProgress({ completedLevelIds, currentLevelId: state.level.id });
          set({ simState, phase, winHoldStartMs, completedLevelIds });
          return;
        }
      } else {
        winHoldStartMs = null;
      }
    }

    const lastSample = state.p99History[state.p99History.length - 1];
    const shouldSampleHud = !lastSample || nowMs - lastSample.t >= HUD_THROTTLE_MS;

    if (shouldSampleHud) {
      const hud: HudSnapshot = {
        p99LatencyMs: simState.global.p99LatencyMs,
        meanLatencyMs: simState.global.meanLatencyMs,
        errorRate: simState.global.errorRate,
        monthlyCost: simState.global.monthlyCost,
      };
      const p99History = [...state.p99History, { t: nowMs, p99: simState.global.p99LatencyMs }].filter(
        (s) => nowMs - s.t <= P99_HISTORY_WINDOW_MS,
      );
      set({ simState, phase, winHoldStartMs, hud, p99History });
    } else {
      set({ simState, phase, winHoldStartMs });
    }
  },

  addNode: (node) => set((s) => ({ graph: { nodes: [...s.graph.nodes, node], edges: s.graph.edges } })),

  removeNode: (nodeId) =>
    set((s) => ({
      graph: {
        nodes: s.graph.nodes.filter((n) => n.id !== nodeId),
        edges: s.graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      },
    })),

  addEdge: (edge) => set((s) => ({ graph: { nodes: s.graph.nodes, edges: [...s.graph.edges, edge] } })),

  removeEdge: (edgeId) =>
    set((s) => ({ graph: { nodes: s.graph.nodes, edges: s.graph.edges.filter((e) => e.id !== edgeId) } })),

  updateNodeConfig: (nodeId, config) =>
    set((s) => ({
      graph: {
        nodes: s.graph.nodes.map((n) => (n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n)),
        edges: s.graph.edges,
      },
    })),
}));
