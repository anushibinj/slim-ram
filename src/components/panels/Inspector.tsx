import { useGameStore } from "../../store/gameStore";
import { NODE_LABELS } from "../canvas/nodes/nodeLabels";

export function Inspector() {
  const selectedNodeId = useGameStore((s) => s.selectedNodeId);
  const node = useGameStore((s) => s.graph.nodes.find((n) => n.id === s.selectedNodeId));
  const metrics = useGameStore((s) => (s.selectedNodeId ? s.simState.nodes[s.selectedNodeId] : undefined));
  const phase = useGameStore((s) => s.phase);
  const selectNode = useGameStore((s) => s.selectNode);
  const removeNode = useGameStore((s) => s.removeNode);
  const updateNodeConfig = useGameStore((s) => s.updateNodeConfig);

  if (!selectedNodeId || !node) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center text-sm text-slate-400">
        <p>Tap a node to inspect it.</p>
      </div>
    );
  }

  const editable = phase === "editing";

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{NODE_LABELS[node.type]}</h2>
        <button
          type="button"
          onClick={() => selectNode(null)}
          className="rounded px-2 text-slate-400 hover:bg-slate-100"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      {metrics && (
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs">
          <dt className="text-slate-500">Incoming</dt>
          <dd className="text-right font-medium text-slate-800">{metrics.incomingRps.toFixed(0)} rps</dd>
          <dt className="text-slate-500">Utilization</dt>
          <dd className="text-right font-medium text-slate-800">{(metrics.utilization * 100).toFixed(0)}%</dd>
          <dt className="text-slate-500">Latency</dt>
          <dd className="text-right font-medium text-slate-800">{metrics.latencyMs.toFixed(0)} ms</dd>
          <dt className="text-slate-500">Error rate</dt>
          <dd className="text-right font-medium text-slate-800">{(metrics.errorRate * 100).toFixed(1)}%</dd>
        </dl>
      )}

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <dt className="text-slate-500">Capacity</dt>
        <dd className="text-right text-slate-700">{Number.isFinite(node.capacityRps) ? `${node.capacityRps} rps` : "—"}</dd>
        <dt className="text-slate-500">Cost</dt>
        <dd className="text-right text-slate-700">${node.costPerMonth}/mo</dd>
      </dl>

      {node.type === "cache" && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-500">Cache hit ratio: {Math.round((node.config.hitRatio ?? 0.8) * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            disabled={!editable}
            value={node.config.hitRatio ?? 0.8}
            onChange={(e) => updateNodeConfig(node.id, { hitRatio: Number(e.target.value) })}
            style={{ minHeight: 44 }}
          />
        </label>
      )}

      {node.type === "app_server" && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-500">Server count: {node.config.serverCount ?? 1}</span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            disabled={!editable}
            value={node.config.serverCount ?? 1}
            onChange={(e) => updateNodeConfig(node.id, { serverCount: Number(e.target.value) })}
            style={{ minHeight: 44 }}
          />
        </label>
      )}

      {editable && node.type !== "client" && (
        <button
          type="button"
          onClick={() => removeNode(node.id)}
          className="mt-auto rounded border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          style={{ minHeight: 44 }}
        >
          Remove node
        </button>
      )}
    </div>
  );
}
