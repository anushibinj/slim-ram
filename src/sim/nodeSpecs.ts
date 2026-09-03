import type { NodeSpec, NodeType } from "./types";

export interface NodeTypeDefaults {
  capacityRps: number;
  baseLatencyMs: number;
  costPerMonth: number;
  config: Record<string, number>;
}

export const NODE_TYPE_DEFAULTS: Record<NodeType, NodeTypeDefaults> = {
  client: { capacityRps: Infinity, baseLatencyMs: 0, costPerMonth: 0, config: {} },
  app_server: { capacityRps: 200, baseLatencyMs: 20, costPerMonth: 20, config: { serverCount: 1 } },
  database: { capacityRps: 150, baseLatencyMs: 15, costPerMonth: 80, config: {} },
  cache: { capacityRps: 5000, baseLatencyMs: 2, costPerMonth: 15, config: { hitRatio: 0.8 } },
  load_balancer: { capacityRps: 10000, baseLatencyMs: 2, costPerMonth: 25, config: {} },
  cdn: { capacityRps: 50000, baseLatencyMs: 5, costPerMonth: 10, config: {} },
  read_replica: { capacityRps: 150, baseLatencyMs: 15, costPerMonth: 60, config: {} },
};

export function createNodeSpec(
  id: string,
  type: NodeType,
  overrides: Partial<Omit<NodeSpec, "id" | "type">> = {},
): NodeSpec {
  const defaults = NODE_TYPE_DEFAULTS[type];
  return {
    id,
    type,
    capacityRps: overrides.capacityRps ?? defaults.capacityRps,
    baseLatencyMs: overrides.baseLatencyMs ?? defaults.baseLatencyMs,
    costPerMonth: overrides.costPerMonth ?? defaults.costPerMonth,
    config: { ...defaults.config, ...overrides.config },
  };
}
