import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { createNodeSpec, type NodeType } from "../../sim";
import { useGameStore } from "../../store/gameStore";
import { ParticleLayer } from "./ParticleLayer";
import { SimNode, type SimFlowNode } from "./nodes/SimNode";

export const DRAG_MIME_TYPE = "application/slim-ram-node-type";

const nodeTypes = { simNode: SimNode };

function GraphCanvasInner() {
  const graph = useGameStore((s) => s.graph);
  const positions = useGameStore((s) => s.positions);
  const phase = useGameStore((s) => s.phase);
  const addEdge = useGameStore((s) => s.addEdge);
  const addNode = useGameStore((s) => s.addNode);
  const removeEdge = useGameStore((s) => s.removeEdge);
  const removeNode = useGameStore((s) => s.removeNode);
  const setNodePosition = useGameStore((s) => s.setNodePosition);
  const { screenToFlowPosition } = useReactFlow();

  const editable = phase === "editing";

  const nodes: SimFlowNode[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "simNode",
        position: positions[n.id] ?? { x: 0, y: 0 },
        data: { nodeType: n.type },
      })),
    [graph.nodes, positions],
  );

  const edges: Edge[] = useMemo(
    () => graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: true })),
    [graph.edges],
  );

  function handleNodesChange(changes: NodeChange<SimFlowNode>[]) {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        setNodePosition(change.id, change.position);
      } else if (change.type === "remove" && editable) {
        removeNode(change.id);
      }
    }
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    for (const change of changes) {
      if (change.type === "remove" && editable) {
        removeEdge(change.id);
      }
    }
  }

  function handleConnect(connection: Connection) {
    if (!editable || !connection.source || !connection.target) return;
    const id = `${connection.source}->${connection.target}`;
    if (graph.edges.some((e) => e.id === id)) return;
    addEdge({ id, source: connection.source, target: connection.target });
  }

  function handleDragOver(e: React.DragEvent) {
    if (!editable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent) {
    if (!editable) return;
    const type = e.dataTransfer.getData(DRAG_MIME_TYPE) as NodeType;
    if (!type) return;
    e.preventDefault();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    addNode(createNodeSpec(id, type), position);
  }

  return (
    <div className="relative h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ParticleLayer />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={editable}
        edgesReconnectable={editable}
        deleteKeyCode={editable ? ["Backspace", "Delete"] : []}
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}
