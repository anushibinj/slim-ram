import { LEVELS } from "../../levels";
import type { Level } from "../../levels";
import { useGameStore } from "../../store/gameStore";
import { NODE_LABELS } from "../canvas/nodes/nodeLabels";
import { Modal } from "./Modal";

function BriefingContent({ level }: { level: Level }) {
  const levelIndex = LEVELS.findIndex((l) => l.id === level.id);

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
        Level {levelIndex + 1} of {LEVELS.length}
      </p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{level.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{level.briefing}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {level.allowedNodeTypes.map((type) => (
          <span key={type} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {NODE_LABELS[type]}
          </span>
        ))}
      </div>

      {level.budgetCap !== undefined && (
        <p className="mt-3 text-sm font-medium text-amber-600">Budget cap: ${level.budgetCap}/mo</p>
      )}
    </>
  );
}

export function BriefingModal() {
  const level = useGameStore((s) => s.level);
  const dismissBriefing = useGameStore((s) => s.dismissBriefing);

  return (
    <Modal>
      <BriefingContent level={level} />

      <p className="mt-4 text-xs text-slate-400">
        The system starts out live and broken — jump in and start fixing it as soon as you're ready.
      </p>

      <button
        type="button"
        onClick={() => dismissBriefing()}
        className="mt-5 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        style={{ minHeight: 44 }}
      >
        Start fixing it
      </button>
    </Modal>
  );
}

/** The same briefing, reopenable on demand mid-level without touching game phase. */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const level = useGameStore((s) => s.level);

  return (
    <Modal>
      <BriefingContent level={level} />

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        style={{ minHeight: 44 }}
      >
        Got it
      </button>
    </Modal>
  );
}
