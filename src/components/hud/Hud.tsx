import { useGameStore } from "../../store/gameStore";

function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

/**
 * Always-visible HUD reading the throttled ~4Hz `hud` slice of the store —
 * never the raw 10Hz simState — so it re-renders a handful of times a
 * second instead of on every sim tick.
 */
export function Hud() {
  const hud = useGameStore((s) => s.hud);
  const level = useGameStore((s) => s.level);
  const phase = useGameStore((s) => s.phase);
  const budgetCap = level.budgetCap ?? level.winCondition.maxMonthlyCost;
  const overBudget = budgetCap !== undefined && hud.monthlyCost > budgetCap;
  const overError = level.winCondition.maxErrorRate !== undefined && hud.errorRate > level.winCondition.maxErrorRate;
  const overP99 = level.winCondition.maxP99Ms !== undefined && hud.p99LatencyMs > level.winCondition.maxP99Ms;

  return (
    <div className="flex items-center gap-4 overflow-x-auto px-3 py-2 text-sm">
      <HudStat
        label="p99"
        value={formatLatency(hud.p99LatencyMs)}
        target={level.winCondition.maxP99Ms !== undefined ? `target < ${formatLatency(level.winCondition.maxP99Ms)}` : undefined}
        warn={overP99}
      />
      <HudStat
        label="errors"
        value={`${(hud.errorRate * 100).toFixed(1)}%`}
        target={
          level.winCondition.maxErrorRate !== undefined
            ? `target < ${(level.winCondition.maxErrorRate * 100).toFixed(0)}%`
            : undefined
        }
        warn={overError}
      />
      <HudStat
        label="cost"
        value={`$${hud.monthlyCost.toFixed(0)}/mo`}
        target={budgetCap !== undefined ? `budget $${budgetCap}` : undefined}
        warn={overBudget}
      />
      {phase === "editing" && (
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
          Hold all targets for 3s to win
        </span>
      )}
    </div>
  );
}

function HudStat({ label, value, target, warn }: { label: string; value: string; target?: string; warn: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`font-mono text-base font-semibold ${warn ? "text-red-600" : "text-emerald-600"}`}>{value}</span>
      {target && <span className="text-xs text-slate-400">({target})</span>}
    </div>
  );
}
