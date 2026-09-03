export const SATURATION_LATENCY_MULTIPLIER = 100;
export const UTILIZATION_CLAMP = 0.999;

export interface LatencyResult {
  utilization: number;
  latencyMs: number;
  errorRate: number;
}

/**
 * M/M/1-approximation latency curve. Utilization rises linearly with load,
 * but latency goes vertical as utilization approaches capacity — that
 * nonlinearity is the core teaching mechanism of the game and must not be
 * replaced with a linear model.
 */
export function computeLatencyAndError(
  incomingRps: number,
  capacityRps: number,
  baseLatencyMs: number,
): LatencyResult {
  if (incomingRps <= 0) {
    return { utilization: 0, latencyMs: 0, errorRate: 0 };
  }
  if (capacityRps <= 0) {
    return { utilization: Number.POSITIVE_INFINITY, latencyMs: baseLatencyMs * SATURATION_LATENCY_MULTIPLIER, errorRate: 1 };
  }

  const u = incomingRps / capacityRps;
  if (u >= 1) {
    const errorRate = (incomingRps - capacityRps) / incomingRps;
    return { utilization: u, latencyMs: baseLatencyMs * SATURATION_LATENCY_MULTIPLIER, errorRate };
  }

  const clampedU = Math.min(u, UTILIZATION_CLAMP);
  return { utilization: u, latencyMs: baseLatencyMs / (1 - clampedU), errorRate: 0 };
}
