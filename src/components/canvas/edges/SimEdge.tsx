import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import { useGameStore } from "../../../store/gameStore";

/**
 * A plain dashed line has a hit area too thin to reliably click, especially
 * on touch — so instead of relying on select-then-press-Delete, every edge
 * carries its own always-visible remove button at its midpoint.
 */
export function SimEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style }: EdgeProps) {
  const editable = useGameStore((s) => s.phase === "editing");
  const removeEdge = useGameStore((s) => s.removeEdge);

  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {editable && (
        <EdgeLabelRenderer>
          <button
            type="button"
            data-edge-id={id}
            onClick={(e) => {
              e.stopPropagation();
              removeEdge(id);
            }}
            className="nodrag nopan pointer-events-auto absolute flex items-center justify-center"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              width: 44,
              height: 44,
            }}
            aria-label="Remove connection"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-500 shadow hover:border-red-400 hover:text-red-600">
              ✕
            </span>
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
