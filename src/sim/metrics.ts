import type { FlowByClass } from "./engine";
import type { ClassRecord, GlobalMetrics, SimGraph, TrafficProfile } from "./types";
import { TRAFFIC_CLASSES, zeroClassRecord } from "./types";

// TODO: this needs a real latency distribution once we have per-request
// samples; a fixed multiple of the mean is a placeholder approximation.
const P99_MULTIPLIER = 2.5;

export function computeGlobalMetrics(
  graph: SimGraph,
  terminal: FlowByClass,
  errored: ClassRecord,
  profile: TrafficProfile,
): GlobalMetrics {
  const latencyByClass = zeroClassRecord();
  let totalCompletedRps = 0;
  let totalLatencyMass = 0;
  for (const c of TRAFFIC_CLASSES) {
    latencyByClass[c] = terminal[c].avgLatencyMs;
    totalCompletedRps += terminal[c].rps;
    totalLatencyMass += terminal[c].rps * terminal[c].avgLatencyMs;
  }
  const meanLatencyMs = totalCompletedRps > 0 ? totalLatencyMass / totalCompletedRps : 0;
  const p99LatencyMs = meanLatencyMs * P99_MULTIPLIER;

  const totalErroredRps = errored.static + errored.read + errored.write;
  const errorRate = profile.totalRps > 0 ? totalErroredRps / profile.totalRps : 0;

  const monthlyCost = graph.nodes.reduce((sum, n) => sum + n.costPerMonth, 0);

  return { latencyByClass, meanLatencyMs, p99LatencyMs, errorRate, monthlyCost };
}
