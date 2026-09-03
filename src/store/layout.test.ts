import { describe, expect, it } from "vitest";
import { createNodeSpec } from "../sim";
import type { SimGraph } from "../sim";
import { layoutGraph } from "./layout";

describe("layoutGraph", () => {
  it("places a linear chain left to right in increasing columns", () => {
    const graph: SimGraph = {
      nodes: [createNodeSpec("a", "client"), createNodeSpec("b", "app_server"), createNodeSpec("c", "database")],
      edges: [
        { id: "e0", source: "a", target: "b" },
        { id: "e1", source: "b", target: "c" },
      ],
    };
    const positions = layoutGraph(graph);
    expect(positions.a.x).toBeLessThan(positions.b.x);
    expect(positions.b.x).toBeLessThan(positions.c.x);
  });

  it("stacks siblings at the same column into different rows", () => {
    const graph: SimGraph = {
      nodes: [
        createNodeSpec("lb", "load_balancer"),
        createNodeSpec("app1", "app_server"),
        createNodeSpec("app2", "app_server"),
      ],
      edges: [
        { id: "e0", source: "lb", target: "app1" },
        { id: "e1", source: "lb", target: "app2" },
      ],
    };
    const positions = layoutGraph(graph);
    expect(positions.app1.x).toBe(positions.app2.x);
    expect(positions.app1.y).not.toBe(positions.app2.y);
  });

  it("terminates instead of looping forever on a cyclic graph", () => {
    const graph: SimGraph = {
      nodes: [createNodeSpec("a", "app_server"), createNodeSpec("b", "database")],
      edges: [
        { id: "e0", source: "a", target: "b" },
        { id: "e1", source: "b", target: "a" },
      ],
    };
    expect(() => layoutGraph(graph)).not.toThrow();
    const positions = layoutGraph(graph);
    expect(Object.keys(positions).sort()).toEqual(["a", "b"]);
  });

  it("gives every node in the graph a position", () => {
    const graph: SimGraph = {
      nodes: [createNodeSpec("solo", "cdn")],
      edges: [],
    };
    expect(layoutGraph(graph)).toEqual({ solo: { x: 0, y: 0 } });
  });
});
