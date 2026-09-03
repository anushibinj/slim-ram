import { Handle, Position as HandlePosition } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { NodeType } from "../../../sim";
import { useGameStore } from "../../../store/gameStore";
import { NODE_LABELS } from "./nodeLabels";

const ICONS: Record<NodeType, string> = {
  client: "🖥️",
  app_server: "⚙️",
  database: "🗄️",
  cache: "⚡",
  load_balancer: "⚖️",
  cdn: "🌐",
  read_replica: "📚",
};

function utilizationBarColor(u: number): string {
  if (u >= 1) return "bg-red-500";
  if (u >= 0.7) return "bg-amber-500";
  return "bg-emerald-500";
}

function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export interface SimNodeData extends Record<string, unknown> {
  nodeType: NodeType;
}

export type SimFlowNode = Node<SimNodeData, "simNode">;

export function SimNode({ id, data, selected }: NodeProps<SimFlowNode>) {
  const metrics = useGameStore((s) => s.simState.nodes[id]);
  const connectSourceId = useGameStore((s) => s.connectSourceId);
  const selectNode = useGameStore((s) => s.selectNode);
  const beginConnect = useGameStore((s) => s.beginConnect);
  const completeConnect = useGameStore((s) => s.completeConnect);

  const isConnectSource = connectSourceId === id;
  const isConnectPending = connectSourceId !== null;
  const utilization = metrics?.utilization ?? 0;
  const latencyMs = metrics?.latencyMs ?? 0;

  function handleTap() {
    if (isConnectPending) {
      if (isConnectSource) return;
      completeConnect(id);
      return;
    }
    selectNode(id);
  }

  function handleConnectHandleTap(e: React.MouseEvent) {
    e.stopPropagation();
    if (isConnectPending && !isConnectSource) {
      completeConnect(id);
    } else {
      beginConnect(id);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleTap();
      }}
      className={`min-w-[140px] rounded-lg border-2 bg-white px-3 py-2 shadow-md transition-colors ${
        selected ? "border-indigo-500" : isConnectSource ? "border-amber-500" : "border-slate-300"
      }`}
      style={{ minHeight: 44 }}
    >
      <Handle type="target" position={HandlePosition.Left} className="!h-3 !w-3" />
      <Handle type="source" position={HandlePosition.Right} className="!h-3 !w-3" />

      <div className="flex items-center gap-2">
        <span className="text-lg leading-none" aria-hidden="true">
          {ICONS[data.nodeType]}
        </span>
        <span className="text-sm font-semibold text-slate-800">{NODE_LABELS[data.nodeType]}</span>
      </div>

      {data.nodeType !== "client" && (
        <>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${utilizationBarColor(utilization)}`}
              style={{ width: `${Math.min(100, utilization * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{Math.round(utilization * 100)}% util</span>
            <span>{formatLatency(latencyMs)}</span>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={handleConnectHandleTap}
        className="mt-2 w-full rounded border border-slate-300 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        style={{ minHeight: 32 }}
      >
        {isConnectSource ? "Cancel connect" : isConnectPending ? "Connect here" : "Connect…"}
      </button>
    </div>
  );
}
