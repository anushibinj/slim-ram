import { getNextLevelId } from "../../levels";
import { useGameStore } from "../../store/gameStore";
import { Modal } from "./Modal";

export function WinModal({ onKeepPlaying }: { onKeepPlaying: () => void }) {
  const level = useGameStore((s) => s.level);
  const hud = useGameStore((s) => s.hud);
  const loadLevel = useGameStore((s) => s.loadLevel);
  const nextLevelId = getNextLevelId(level.id);

  return (
    <Modal>
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Fixed</p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{level.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{level.explainer}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center text-xs">
        <div>
          <dt className="text-slate-400">p99</dt>
          <dd className="font-mono font-semibold text-slate-800">{Math.round(hud.p99LatencyMs)}ms</dd>
        </div>
        <div>
          <dt className="text-slate-400">errors</dt>
          <dd className="font-mono font-semibold text-slate-800">{(hud.errorRate * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-slate-400">cost</dt>
          <dd className="font-mono font-semibold text-slate-800">${hud.monthlyCost.toFixed(0)}/mo</dd>
        </div>
      </dl>

      {!nextLevelId && (
        <p className="mt-4 text-center text-sm font-medium text-slate-700">
          That's all five levels — you've completed Slim RAM.
        </p>
      )}

      {nextLevelId && (
        <button
          type="button"
          onClick={() => loadLevel(nextLevelId)}
          className="mt-5 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          style={{ minHeight: 44 }}
        >
          Next level
        </button>
      )}

      <button
        type="button"
        onClick={onKeepPlaying}
        className={`w-full rounded-lg border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${nextLevelId ? "mt-3" : "mt-5"}`}
        style={{ minHeight: 44 }}
      >
        Play around in this level
      </button>

      {!nextLevelId && (
        <button
          type="button"
          onClick={() => loadLevel(level.id)}
          className="mt-3 w-full rounded-lg py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
          style={{ minHeight: 44 }}
        >
          Restart from scratch
        </button>
      )}

      {nextLevelId && (
        <p className="mt-3 text-center text-xs text-slate-400">
          A "✓ Next level" button stays in the header whenever you're ready.
        </p>
      )}
    </Modal>
  );
}
