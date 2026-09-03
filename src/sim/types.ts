export type TrafficClass = "static" | "read" | "write";

export const TRAFFIC_CLASSES: readonly TrafficClass[] = ["static", "read", "write"];

export type ClassRecord = Record<TrafficClass, number>;

export function zeroClassRecord(): ClassRecord {
  return { static: 0, read: 0, write: 0 };
}

export interface TrafficMix {
  static: number;
  read: number;
  write: number;
}

export interface TrafficProfile {
  totalRps: number;
  mix: TrafficMix;
}

export type NodeType =
  | "client"
  | "app_server"
  | "database"
  | "cache"
  | "load_balancer"
  | "cdn"
  | "read_replica";

export interface NodeSpec {
  id: string;
  type: NodeType;
  capacityRps: number;
  baseLatencyMs: number;
  costPerMonth: number;
  config: Record<string, number>;
}

export interface EdgeSpec {
  id: string;
  source: string;
  target: string;
}

export interface SimGraph {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

export interface NodeMetrics {
  nodeId: string;
  incomingRps: number;
  utilization: number;
  latencyMs: number;
  errorRate: number;
}

export interface EdgeMetrics {
  edgeId: string;
  rps: number;
  byClass: ClassRecord;
}

export interface GlobalMetrics {
  latencyByClass: ClassRecord;
  meanLatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  monthlyCost: number;
}

export interface SimState {
  nodes: Record<string, NodeMetrics>;
  edges: Record<string, EdgeMetrics>;
  global: GlobalMetrics;
  dt: number;
}
