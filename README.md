# Slim RAM

A browser game that teaches system design through an interactive node-graph
simulator. Wire up caches, load balancers, CDNs, and read replicas to keep a
system's p99 latency, error rate, and monthly cost under control across five
Learn-mode levels.

## Stack

Vite + React 18 + TypeScript (strict), `@xyflow/react` for the canvas,
Zustand for state, Tailwind for UI, Vitest for the engine's test suite,
Recharts for the metrics graph. The simulation engine (`src/sim/`) is pure
TypeScript with zero dependencies on React, the DOM, or any rendering
library — it's deterministic, synchronous, and fully unit-testable in Node.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the engine + store test suite
npm run build    # production build (dist/), ready for static hosting
npm run lint      # eslint
```

## Project layout

```
src/
  sim/        pure simulation engine — no React, no DOM
  levels/     the five Learn-mode level definitions
  store/      zustand game store, localStorage-backed progress, layout
  components/ canvas, panels, HUD, modals
```

Capacitor is configured (`capacitor.config.ts`) for a future native build,
but no platform has been added yet.
