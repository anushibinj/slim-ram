import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useGameStore } from "../../store/gameStore";

/**
 * Rolling ~30s line chart of p99 latency, so a fix landing shows up as a
 * visible cliff instead of just a number changing.
 */
export function MetricsPanel() {
  const p99History = useGameStore((s) => s.p99History);

  const data = p99History.map((sample) => ({
    t: (sample.t - (p99History[0]?.t ?? sample.t)) / 1000,
    p99: Math.round(sample.p99),
  }));

  return (
    <div className="flex h-full flex-col p-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">p99 latency (30s)</h2>
      <div className="min-h-0 flex-1">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Collecting data…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}s`} />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Line type="monotone" dataKey="p99" stroke="#4f46e5" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
