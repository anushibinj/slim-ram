import type { SimGraph } from "../sim";

export interface Position {
  x: number;
  y: number;
}

const COLUMN_WIDTH = 220;
const ROW_HEIGHT = 140;

/**
 * Deterministic left-to-right auto-layout: a node's column is its BFS
 * distance from the client (or from any in-degree-0 node, for a
 * disconnected piece), and its row is its index among siblings at that
 * column. Purely a rendering concern — SimGraph itself has no notion of
 * position, and this never touches simulation state.
 */
export function layoutGraph(graph: SimGraph): Record<string, Position> {
  const outEdges = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of graph.nodes) {
    outEdges.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of graph.edges) {
    outEdges.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const column = new Map<string, number>();
  const queue: string[] = [];
  for (const n of graph.nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      column.set(n.id, 0);
      queue.push(n.id);
    }
  }

  // The UI may transiently allow a cycle before the player finishes wiring
  // (the sim engine itself rejects cycles at simulation time) — cap total
  // relaxations so a cycle can't spin this loop forever.
  const maxSteps = graph.nodes.length * graph.nodes.length + graph.edges.length;
  let steps = 0;
  while (queue.length > 0 && steps < maxSteps) {
    steps++;
    const id = queue.shift()!;
    const depth = column.get(id) ?? 0;
    for (const target of outEdges.get(id) ?? []) {
      const next = depth + 1;
      if ((column.get(target) ?? -1) < next) {
        column.set(target, next);
        queue.push(target);
      }
    }
  }

  const rowsUsed = new Map<number, number>();
  const positions: Record<string, Position> = {};
  for (const n of graph.nodes) {
    const col = column.get(n.id) ?? 0;
    const row = rowsUsed.get(col) ?? 0;
    rowsUsed.set(col, row + 1);
    positions[n.id] = { x: col * COLUMN_WIDTH, y: row * ROW_HEIGHT };
  }
  return positions;
}
