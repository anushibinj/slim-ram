import { simulateGraph } from "./engine";
import { computeGlobalMetrics } from "./metrics";
import type { SimGraph, SimState, TrafficProfile } from "./types";

export * from "./types";
export { computeLatencyAndError, simulateGraph } from "./engine";
export type { ClassFlow, FlowByClass, ProcessResult, SimulationResult } from "./engine";
export { computeGlobalMetrics } from "./metrics";
export { NODE_TYPE_DEFAULTS, createNodeSpec } from "./nodeSpecs";
export type { NodeTypeDefaults } from "./nodeSpecs";

/**
 * The single entry point into the simulation engine: pure, synchronous,
 * and a function of its arguments only — no hidden state, no DOM, no
 * rendering-library imports. `dt` is accepted (and echoed back) for
 * callers doing their own fixed-step integration, but the steady-state
 * formulas here don't need it themselves; that keeps this call safe to
 * move into a Web Worker later without changing its signature.
 */
export function tick(graph: SimGraph, profile: TrafficProfile, dt: number): SimState {
  const { nodeMetrics, terminal, errored } = simulateGraph(graph, profile);
  const global = computeGlobalMetrics(graph, terminal, errored, profile);
  return { nodes: nodeMetrics, global, dt };
}
