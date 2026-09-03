import { NODE_TYPE_DEFAULTS, createNodeSpec } from "../../sim";
import { useGameStore } from "../../store/gameStore";
import { DRAG_MIME_TYPE } from "../canvas/GraphCanvas";
import { NODE_LABELS } from "../canvas/nodes/SimNode";

const ICONS: Record<string, string> = {
  client: "🖥️",
  app_server: "⚙️",
  database: "🗄️",
  cache: "⚡",
  load_balancer: "⚖️",
  cdn: "🌐",
  read_replica: "📚",
};

/**
 * Draggable + tap-to-add list of the node types this level allows placing.
 * Drag onto the canvas on desktop; tap on any device, including touch,
 * where it's added at a default offset position.
 */
export function Palette() {
  const level = useGameStore((s) => s.level);
  const phase = useGameStore((s) => s.phase);
  const addNode = useGameStore((s) => s.addNode);

  const editable = phase === "editing";

  function handleAdd(type: (typeof level.allowedNodeTypes)[number]) {
    if (!editable) return;
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    addNode(createNodeSpec(id, type));
  }

  function handleDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData(DRAG_MIME_TYPE, type);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Palette</h2>
      {level.allowedNodeTypes.length === 0 && <p className="text-sm text-slate-400">Nothing to place this level.</p>}
      {level.allowedNodeTypes.map((type) => {
        const defaults = NODE_TYPE_DEFAULTS[type];
        return (
          <button
            key={type}
            type="button"
            draggable={editable}
            disabled={!editable}
            onDragStart={(e) => handleDragStart(e, type)}
            onClick={() => handleAdd(type)}
            className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ minHeight: 44 }}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {ICONS[type]}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-800">{NODE_LABELS[type]}</span>
              <span className="block text-xs text-slate-500">${defaults.costPerMonth}/mo</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
