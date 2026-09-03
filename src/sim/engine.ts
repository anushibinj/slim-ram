import type {
  ClassRecord,
  EdgeSpec,
  NodeMetrics,
  NodeSpec,
  NodeType,
  SimGraph,
  TrafficClass,
  TrafficProfile,
} from "./types";
import { TRAFFIC_CLASSES, zeroClassRecord } from "./types";

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

/**
 * A flow of one traffic class moving through the graph: how much of it
 * there is, and the rps-weighted average end-to-end latency accumulated by
 * the requests in it so far. Tracking an average (rather than a full list)
 * keeps merges at fan-in nodes and splits at fan-out nodes O(1) per class.
 */
export interface ClassFlow {
  rps: number;
  avgLatencyMs: number;
}

export type FlowByClass = Record<TrafficClass, ClassFlow>;

function zeroFlow(): FlowByClass {
  return {
    static: { rps: 0, avgLatencyMs: 0 },
    read: { rps: 0, avgLatencyMs: 0 },
    write: { rps: 0, avgLatencyMs: 0 },
  };
}

function mergeClassFlow(a: ClassFlow, b: ClassFlow): ClassFlow {
  const rps = a.rps + b.rps;
  if (rps <= 0) return { rps: 0, avgLatencyMs: 0 };
  return { rps, avgLatencyMs: (a.rps * a.avgLatencyMs + b.rps * b.avgLatencyMs) / rps };
}

function mergeFlow(a: FlowByClass, b: FlowByClass): FlowByClass {
  const out = {} as FlowByClass;
  for (const c of TRAFFIC_CLASSES) {
    out[c] = mergeClassFlow(a[c], b[c]);
  }
  return out;
}

function splitFlow(flow: FlowByClass, ways: number): FlowByClass {
  if (ways <= 1) return flow;
  const out = {} as FlowByClass;
  for (const c of TRAFFIC_CLASSES) {
    out[c] = { rps: flow[c].rps / ways, avgLatencyMs: flow[c].avgLatencyMs };
  }
  return out;
}

function addClassRecords(a: ClassRecord, b: ClassRecord): ClassRecord {
  return { static: a.static + b.static, read: a.read + b.read, write: a.write + b.write };
}

/**
 * How a node type handles each traffic class:
 * - "passthrough": flows through unchanged — no capacity consumed, no latency added.
 * - "forward": consumes capacity, adds the node's latency, continues downstream.
 * - "absorb": consumes capacity, adds the node's latency, terminates here.
 * - "reject": rejected before it ever consumes capacity — 100% error, no latency.
 * A class with no entry for a node type defaults to "passthrough".
 */
type ClassBehavior =
  | { kind: "passthrough" }
  | { kind: "forward"; latencyMultiplier?: number }
  | { kind: "absorb"; latencyMultiplier?: number }
  | { kind: "reject" };

type NodeBehavior = Partial<Record<TrafficClass, ClassBehavior>>;

const APP_SERVER_STATIC_LATENCY_MULTIPLIER = 3;

const NODE_BEHAVIOR: Partial<Record<NodeType, NodeBehavior>> = {
  app_server: {
    static: { kind: "absorb", latencyMultiplier: APP_SERVER_STATIC_LATENCY_MULTIPLIER },
    read: { kind: "forward" },
    write: { kind: "forward" },
  },
  database: {
    read: { kind: "absorb" },
    write: { kind: "absorb" },
  },
  load_balancer: {
    static: { kind: "forward" },
    read: { kind: "forward" },
    write: { kind: "forward" },
  },
  cdn: {
    static: { kind: "absorb" },
    read: { kind: "passthrough" },
    write: { kind: "passthrough" },
  },
  read_replica: {
    read: { kind: "absorb" },
    write: { kind: "reject" },
  },
};

export interface ProcessResult {
  metrics: NodeMetrics;
  forward: FlowByClass;
  terminal: FlowByClass;
  errored: ClassRecord;
}

function processClientNode(node: NodeSpec, profile: TrafficProfile): ProcessResult {
  const forward: FlowByClass = {
    static: { rps: profile.totalRps * profile.mix.static, avgLatencyMs: 0 },
    read: { rps: profile.totalRps * profile.mix.read, avgLatencyMs: 0 },
    write: { rps: profile.totalRps * profile.mix.write, avgLatencyMs: 0 },
  };
  return {
    metrics: { nodeId: node.id, incomingRps: profile.totalRps, utilization: 0, latencyMs: 0, errorRate: 0 },
    forward,
    terminal: zeroFlow(),
    errored: zeroClassRecord(),
  };
}

/**
 * app_server is the one node type horizontally scaled from its own
 * Inspector panel (config.serverCount) rather than by wiring up extra
 * node instances, so its effective capacity is the per-instance capacity
 * times how many instances the config says stand behind it.
 */
function effectiveCapacity(node: NodeSpec): number {
  if (node.type === "app_server") {
    const serverCount = Math.max(1, node.config.serverCount ?? 1);
    return node.capacityRps * serverCount;
  }
  return node.capacityRps;
}

function processGenericNode(node: NodeSpec, incoming: FlowByClass): ProcessResult {
  const behavior = NODE_BEHAVIOR[node.type] ?? {};

  let consumedRps = 0;
  for (const c of TRAFFIC_CLASSES) {
    const b = behavior[c];
    if (b && b.kind !== "passthrough" && b.kind !== "reject") {
      consumedRps += incoming[c].rps;
    }
  }

  const { utilization, latencyMs, errorRate } = computeLatencyAndError(consumedRps, effectiveCapacity(node), node.baseLatencyMs);
  const survivalFactor = 1 - errorRate;

  const forward = zeroFlow();
  const terminal = zeroFlow();
  const errored = zeroClassRecord();
  let totalIncomingRps = 0;
  let totalErroredRps = 0;

  for (const c of TRAFFIC_CLASSES) {
    const inFlow = incoming[c];
    totalIncomingRps += inFlow.rps;
    const b = behavior[c];

    if (!b || b.kind === "passthrough") {
      forward[c] = inFlow;
      continue;
    }
    if (b.kind === "reject") {
      errored[c] += inFlow.rps;
      totalErroredRps += inFlow.rps;
      continue;
    }

    const survivingRps = inFlow.rps * survivalFactor;
    const droppedRps = inFlow.rps - survivingRps;
    errored[c] += droppedRps;
    totalErroredRps += droppedRps;
    if (survivingRps <= 0) continue;

    const addedLatency = latencyMs * (b.latencyMultiplier ?? 1);
    const outFlow: ClassFlow = { rps: survivingRps, avgLatencyMs: inFlow.avgLatencyMs + addedLatency };
    if (b.kind === "forward") {
      forward[c] = outFlow;
    } else {
      terminal[c] = outFlow;
    }
  }

  return {
    metrics: {
      nodeId: node.id,
      incomingRps: consumedRps,
      utilization,
      latencyMs,
      errorRate: totalIncomingRps > 0 ? totalErroredRps / totalIncomingRps : 0,
    },
    forward,
    terminal,
    errored,
  };
}

const DEFAULT_CACHE_HIT_RATIO = 0.8;

/**
 * Cache is the one node type whose class routing doesn't fit the generic
 * forward/absorb table: a hit ratio splits read traffic into an absorbed
 * (hit) share and a forwarded (miss) share, while static always passes
 * through untouched and write always forwards in full — a cache must never
 * absorb static or write, only reads it actually has cached.
 */
function processCacheNode(node: NodeSpec, incoming: FlowByClass): ProcessResult {
  const hitRatio = Math.min(1, Math.max(0, node.config.hitRatio ?? DEFAULT_CACHE_HIT_RATIO));
  const consumedRps = incoming.read.rps + incoming.write.rps;

  const { utilization, latencyMs, errorRate } = computeLatencyAndError(consumedRps, node.capacityRps, node.baseLatencyMs);
  const survivalFactor = 1 - errorRate;

  const forward = zeroFlow();
  const terminal = zeroFlow();
  const errored = zeroClassRecord();

  forward.static = incoming.static;

  const survivingRead = incoming.read.rps * survivalFactor;
  errored.read = incoming.read.rps - survivingRead;
  const hitRps = survivingRead * hitRatio;
  const missRps = survivingRead - hitRps;
  const readLatency = incoming.read.avgLatencyMs + latencyMs;
  if (hitRps > 0) terminal.read = { rps: hitRps, avgLatencyMs: readLatency };
  if (missRps > 0) forward.read = { rps: missRps, avgLatencyMs: readLatency };

  const survivingWrite = incoming.write.rps * survivalFactor;
  errored.write = incoming.write.rps - survivingWrite;
  if (survivingWrite > 0) {
    forward.write = { rps: survivingWrite, avgLatencyMs: incoming.write.avgLatencyMs + latencyMs };
  }

  const totalIncomingRps = incoming.static.rps + incoming.read.rps + incoming.write.rps;
  const totalErroredRps = errored.read + errored.write;

  return {
    metrics: {
      nodeId: node.id,
      incomingRps: consumedRps,
      utilization,
      latencyMs,
      errorRate: totalIncomingRps > 0 ? totalErroredRps / totalIncomingRps : 0,
    },
    forward,
    terminal,
    errored,
  };
}

function classIsRejectedBy(type: NodeType, c: TrafficClass): boolean {
  return NODE_BEHAVIOR[type]?.[c]?.kind === "reject";
}

function isSpecialized(type: NodeType): boolean {
  return TRAFFIC_CLASSES.some((c) => classIsRejectedBy(type, c));
}

/**
 * Fans a node's forwarded flow out across its outbound edges. load_balancer
 * always splits every class blindly and evenly, per its spec. Every other
 * node routes per class: a class first tries edges leading to a
 * "specialized" node — one that structurally rejects some other class, e.g.
 * a read_replica rejects write — and only falls back to generic edges when
 * no specialized edge accepts it. This is what lets a read_replica wired
 * alongside a database actually take reads off the database instead of a
 * blind split sending half of every class down each edge (which would just
 * dump write traffic on the replica to be rejected). If literally no edge
 * accepts a class, it's sent down every edge anyway so whichever node(s)
 * receive it surface the rejection in their own metrics rather than the
 * error vanishing silently at the routing step.
 */
function routeForward(
  forward: FlowByClass,
  targets: EdgeSpec[],
  nodeById: Map<string, NodeSpec>,
  isLoadBalancer: boolean,
): Map<string, FlowByClass> {
  const perEdgeFlow = new Map<string, FlowByClass>();
  for (const e of targets) perEdgeFlow.set(e.id, zeroFlow());

  if (isLoadBalancer) {
    const split = splitFlow(forward, targets.length);
    for (const e of targets) perEdgeFlow.set(e.id, split);
    return perEdgeFlow;
  }

  for (const c of TRAFFIC_CLASSES) {
    const classFlow = forward[c];
    if (classFlow.rps <= 0) continue;

    const accepting = targets.filter((e) => {
      const target = nodeById.get(e.target);
      return target && !classIsRejectedBy(target.type, c);
    });
    const specialized = accepting.filter((e) => isSpecialized(nodeById.get(e.target)!.type));
    const chosen = specialized.length > 0 ? specialized : accepting.length > 0 ? accepting : targets;

    const share: ClassFlow = { rps: classFlow.rps / chosen.length, avgLatencyMs: classFlow.avgLatencyMs };
    for (const e of chosen) {
      const edgeFlow = perEdgeFlow.get(e.id)!;
      edgeFlow[c] = mergeClassFlow(edgeFlow[c], share);
    }
  }

  return perEdgeFlow;
}

function topologicalOrder(graph: SimGraph): { order: string[]; outEdges: Map<string, EdgeSpec[]> } {
  const outEdges = new Map<string, EdgeSpec[]>();
  const inDegree = new Map<string, number>();
  for (const n of graph.nodes) {
    outEdges.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of graph.edges) {
    outEdges.get(e.source)?.push(e);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of outEdges.get(id) ?? []) {
      const remaining = (inDegree.get(e.target) ?? 0) - 1;
      inDegree.set(e.target, remaining);
      if (remaining === 0) queue.push(e.target);
    }
  }

  if (order.length !== graph.nodes.length) {
    throw new Error("SimGraph contains a cycle");
  }

  return { order, outEdges };
}

export interface SimulationResult {
  nodeMetrics: Record<string, NodeMetrics>;
  terminal: FlowByClass;
  errored: ClassRecord;
}

/**
 * Walks the graph in topological order, propagating per-class request rates
 * from the client through every node according to its behavior, and
 * accumulates the rps-weighted average latency each class experiences along
 * the way. Structured as a single pass over a precomputed topological order
 * so it can be moved into a Web Worker later without changing this API.
 */
export function simulateGraph(graph: SimGraph, profile: TrafficProfile): SimulationResult {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const { order, outEdges } = topologicalOrder(graph);

  const incoming = new Map<string, FlowByClass>();
  for (const n of graph.nodes) incoming.set(n.id, zeroFlow());

  const nodeMetrics: Record<string, NodeMetrics> = {};
  let terminal = zeroFlow();
  let errored = zeroClassRecord();

  for (const id of order) {
    const node = nodeById.get(id);
    if (!node) continue;

    let result: ProcessResult;
    if (node.type === "client") {
      result = processClientNode(node, profile);
    } else if (node.type === "cache") {
      result = processCacheNode(node, incoming.get(id)!);
    } else {
      result = processGenericNode(node, incoming.get(id)!);
    }

    nodeMetrics[id] = result.metrics;
    terminal = mergeFlow(terminal, result.terminal);
    errored = addClassRecords(errored, result.errored);

    const targets = outEdges.get(id) ?? [];
    if (targets.length > 0) {
      const perEdgeFlow = routeForward(result.forward, targets, nodeById, node.type === "load_balancer");
      for (const e of targets) {
        incoming.set(e.target, mergeFlow(incoming.get(e.target)!, perEdgeFlow.get(e.id)!));
      }
    }
  }

  return { nodeMetrics, terminal, errored };
}
