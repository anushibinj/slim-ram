import { useGameStore } from "../../store/gameStore";
import { Modal } from "./Modal";

export function HintModal({ onClose }: { onClose: () => void }) {
  const level = useGameStore((s) => s.level);
  const hintsRevealed = useGameStore((s) => s.hintsRevealed);
  const revealNextHint = useGameStore((s) => s.revealNextHint);

  const total = level.hints.length;
  const allRevealed = hintsRevealed >= total;

  return (
    <Modal>
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Hints</p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{level.title}</h1>

      {hintsRevealed === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Stuck? Reveal a hint below — each one gets more specific.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {level.hints.slice(0, hintsRevealed).map((hint, i) => {
            const isSolution = i === total - 1 && allRevealed;
            return (
              <li
                key={i}
                className={`rounded-lg border p-3 text-sm leading-relaxed ${
                  isSolution ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${isSolution ? "text-emerald-600" : "text-slate-400"}`}>
                  {isSolution ? "Solution" : `Hint ${i + 1}`}
                </span>
                {hint}
              </li>
            );
          })}
        </ol>
      )}

      {!allRevealed && (
        <button
          type="button"
          onClick={revealNextHint}
          className="mt-4 w-full rounded-lg border border-amber-300 bg-amber-50 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100"
          style={{ minHeight: 44 }}
        >
          {hintsRevealed === 0 ? "Show first hint" : `Show next hint (${hintsRevealed + 1} of ${total})`}
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        style={{ minHeight: 44 }}
      >
        Close
      </button>
    </Modal>
  );
}
