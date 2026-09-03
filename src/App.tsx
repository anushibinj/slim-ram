import { useEffect, useState } from "react";
import { GraphCanvas } from "./components/canvas/GraphCanvas";
import { Hud } from "./components/hud/Hud";
import { BriefingModal, HelpModal } from "./components/modals/BriefingModal";
import { HintModal } from "./components/modals/HintModal";
import { WinModal } from "./components/modals/WinModal";
import { Inspector } from "./components/panels/Inspector";
import { MetricsPanel } from "./components/panels/MetricsPanel";
import { Palette } from "./components/panels/Palette";
import { getNextLevelId } from "./levels";
import { SIM_TICK_MS, useGameStore } from "./store/gameStore";

type MobileSheet = "palette" | "metrics" | null;

function App() {
  const phase = useGameStore((s) => s.phase);
  const level = useGameStore((s) => s.level);
  const isSolved = useGameStore((s) => s.completedLevelIds.includes(s.level.id));
  const winModalVisible = useGameStore((s) => s.winModalVisible);
  const dismissWinModal = useGameStore((s) => s.dismissWinModal);
  const loadLevel = useGameStore((s) => s.loadLevel);
  const selectedNodeId = useGameStore((s) => s.selectedNodeId);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const nextLevelId = getNextLevelId(level.id);

  useEffect(() => {
    const id = setInterval(() => useGameStore.getState().stepSimulation(performance.now()), SIM_TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedNodeId) setMobileSheet(null);
  }, [selectedNodeId]);

  const mobileInspectorOpen = selectedNodeId !== null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      <header className="flex items-center border-b border-slate-200 bg-white">
        <div className="min-w-0 flex-1">
          <Hud />
        </div>
        {isSolved && nextLevelId && (
          <button
            type="button"
            onClick={() => loadLevel(nextLevelId)}
            className="mr-2 flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            style={{ minHeight: 44 }}
          >
            ✓ Next level →
          </button>
        )}
        <button
          type="button"
          onClick={() => setHintOpen(true)}
          className="mr-2 flex items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-base hover:bg-amber-100"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="Show hints"
        >
          💡
        </button>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="mr-2 flex items-center justify-center rounded-full border border-slate-300 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="Show level instructions"
        >
          ?
        </button>
      </header>

      {phase === "intro" && (
        <div className="bg-amber-100 px-3 py-1.5 text-center text-xs font-medium text-amber-800">
          Watch it fail — editing unlocks in a moment…
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        <aside className="hidden w-56 flex-col border-r border-slate-200 bg-white md:flex">
          <Palette />
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex-1">
            <GraphCanvas />
          </div>
          <div className="hidden h-40 border-t border-slate-200 bg-white md:block">
            <MetricsPanel />
          </div>
        </main>

        <aside className="hidden w-64 flex-col border-l border-slate-200 bg-white md:flex">
          <Inspector />
        </aside>
      </div>

      <nav className="flex border-t border-slate-200 bg-white md:hidden">
        <button
          type="button"
          onClick={() => setMobileSheet((v) => (v === "palette" ? null : "palette"))}
          className="flex-1 py-3 text-sm font-medium text-slate-600"
          style={{ minHeight: 44 }}
        >
          Palette
        </button>
        <button
          type="button"
          onClick={() => setMobileSheet((v) => (v === "metrics" ? null : "metrics"))}
          className="flex-1 py-3 text-sm font-medium text-slate-600"
          style={{ minHeight: 44 }}
        >
          Metrics
        </button>
      </nav>

      {mobileSheet && !mobileInspectorOpen && (
        <div className="fixed inset-x-0 bottom-14 z-40 max-h-[60vh] overflow-y-auto rounded-t-xl border-t border-slate-200 bg-white shadow-2xl md:hidden">
          <div className="flex justify-end border-b border-slate-100 px-1 py-1">
            <button
              type="button"
              onClick={() => setMobileSheet(null)}
              className="rounded px-2 text-slate-400 hover:bg-slate-100"
              style={{ minHeight: 44, minWidth: 44 }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="h-64">{mobileSheet === "palette" ? <Palette /> : <MetricsPanel />}</div>
        </div>
      )}

      {mobileInspectorOpen && (
        <div className="fixed inset-x-0 bottom-14 z-40 max-h-[60vh] overflow-y-auto rounded-t-xl border-t border-slate-200 bg-white shadow-2xl md:hidden">
          <Inspector />
        </div>
      )}

      {phase === "briefing" && <BriefingModal />}
      {winModalVisible && <WinModal onKeepPlaying={dismissWinModal} />}
      {helpOpen && phase !== "briefing" && !winModalVisible && <HelpModal onClose={() => setHelpOpen(false)} />}
      {hintOpen && phase !== "briefing" && !winModalVisible && <HintModal onClose={() => setHintOpen(false)} />}
    </div>
  );
}

export default App;
