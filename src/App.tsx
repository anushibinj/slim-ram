import { useEffect } from "react";
import { GraphCanvas } from "./components/canvas/GraphCanvas";
import { SIM_TICK_MS, useGameStore } from "./store/gameStore";

function App() {
  useEffect(() => {
    useGameStore.getState().dismissBriefing(performance.now());
    const id = setInterval(() => useGameStore.getState().stepSimulation(performance.now()), SIM_TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-screen w-screen bg-slate-100">
      <GraphCanvas />
    </div>
  );
}

export default App;
