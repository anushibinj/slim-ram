# Slim RAM

Build the MVP of a browser game called **Slim RAM** that teaches system design through an interactive node-graph simulator. Web first, packaged with Capacitor so it can ship to iOS and Android later without a rewrite.

> This is a living spec. When a requested change contradicts something below, the contradicted section is updated in place and the change is logged in **Amendments** at the bottom, rather than silently drifting out of sync with the code.

---

## 1. Non-negotiable architectural rule

**The simulation engine must be pure TypeScript with zero dependencies on React, the DOM, or any rendering library.**

The engine exposes one primary function:

```ts
tick(graph: SimGraph, profile: TrafficProfile, dt: number): SimState
```

It is deterministic, synchronous, and fully unit testable in Node. The UI is a subscriber that reads `SimState`. If any file under `src/sim/` imports React, Zustand, or a browser global, that is a bug.

This matters because the rendering layer will change (React Flow today, possibly a native canvas on mobile later) and the engine must not care.

---

## 2. Stack

- **Vite** + **React 18** + **TypeScript** (strict mode on)
- **@xyflow/react** (React Flow v12) for the node canvas
- **Zustand** for app state, kept outside React render for the hot path
- **Tailwind CSS** for UI
- **Vitest** for engine tests
- **Recharts** for the metrics graphs
- **@capacitor/core** + **@capacitor/cli** configured but no native platform added yet

No backend. No auth. No database. Progress persists to `localStorage` behind a small `storage.ts` adapter so it can swap to Capacitor Preferences later.

---

## 3. The simulation model

### Traffic classes

Every request belongs to exactly one class. This is the core teaching mechanism, so get it right:

| Class | Description | Can a CDN serve it? | Can a cache serve it? | Must it reach the DB? |
|---|---|---|---|---|
| `static` | JS, CSS, images | Yes | No | No |
| `read` | Dynamic read queries | No | Yes, on hit | On miss |
| `write` | Mutations | No | No | Always |

A `TrafficProfile` is `{ totalRps: number, mix: { static: number, read: number, write: number } }` where the mix values sum to 1.

### Node model

Every node has:

```ts
interface NodeSpec {
  id: string;
  type: NodeType;
  capacityRps: number;
  baseLatencyMs: number;
  costPerMonth: number;
  config: Record<string, number>; // type-specific, e.g. hitRatio
}
```

### The latency formula

This single formula is what makes the game teach. Do not replace it with a linear model.

```ts
const u = incomingRps / capacityRps;          // utilization
if (u >= 1) {
  // saturated: queue grows, requests are dropped
  errorRate = (incomingRps - capacityRps) / incomingRps;
  latencyMs = baseLatencyMs * 100;            // effectively timing out
} else {
  latencyMs = baseLatencyMs / (1 - u);        // M/M/1 approximation
}
```

Latency rises nonlinearly and goes vertical near saturation. A DB at 95% utilization sits at 20x its base latency. Dropping it to 50% via a cache produces a dramatic, visible collapse in the latency graph. That reaction is the entire point of the game.

Clamp `u` at 0.999 before the division to avoid infinity.

### Node behaviors

| Type | Capacity (rps) | Base latency (ms) | Cost/mo | Behavior |
|---|---|---|---|---|
| `client` | n/a | 0 | 0 | Traffic source. Emits the `TrafficProfile`. |
| `app_server` | 200 | 20 | $20 | Passes `read` and `write` downstream. Serves `static` itself but at 3x base latency. |
| `database` | 150 | 15 | $80 | Terminal node. Accepts `read` and `write`. |
| `cache` | 5000 | 2 | $15 | `config.hitRatio` default 0.8. Absorbs `hitRatio` of `read` traffic. Passes `(1 - hitRatio)` reads plus 100% of writes downstream. Never absorbs `static` or `write`. |
| `load_balancer` | 10000 | 2 | $25 | Splits all incoming traffic evenly across every outbound edge. |
| `cdn` | 50000 | 5 | $10 | Absorbs 100% of `static`. Passes `read` and `write` through untouched. |
| `read_replica` | 150 | 15 | $60 | Accepts `read` only. Rejects `write` at the edge-validation layer. |

A node that still needs to forward a class downstream but has zero outbound edges to send it down (a deleted node, a disconnected subgraph, an incomplete wiring) counts that traffic as **errored**, not silently dropped — an empty or disconnected graph must never read as a clean, trivial pass on zero latency and zero errors. *(Amendment 3.)*

Traffic between two nodes with more than one outbound edge routes per class: a class prefers an edge leading to a "specialized" node — one that structurally rejects some other class (e.g. `read_replica` rejects `write`) — over a generic one, falling back to an even split across generic edges only when no specialized edge accepts it. This is what lets a `read_replica` wired alongside a `database` actually take reads off the database instead of splitting every class blindly down every edge. `load_balancer` is the one exception: it always splits every class blindly and evenly per its literal spec above. *(Amendment 3.)*

### Metrics computed per tick

- **Per node**: `incomingRps`, `utilization`, `latencyMs`, `errorRate`
- **Global**: end-to-end latency per traffic class (sum along the path), a weighted mean latency, `p99Latency` (for the MVP use `mean * 2.5`, with a `TODO` comment that this needs a real distribution later), total `errorRate`, and `monthlyCost` as the sum of all node costs

---

## 4. MVP scope: Learn mode only

Five levels. No campaign mode, no idle mode, no sandbox. Do not build them.

A `Level` definition contains: an id, a title, a short briefing, the starting graph, the traffic profile, the set of node types the player is allowed to place, an optional budget cap, a win condition (`maxP99Ms`, `maxErrorRate`, `maxMonthlyCost`), and at least 3 progressive hints ending in the concrete solution. *(Amendment 4.)*

**Level 1: The database is on fire.**
Start: `client → app_server → database`. Traffic 400 rps, mix 10/85/5. The DB is at ~2x capacity and dying.
Allowed: `cache`.
Teaches: read caching, and that utilization headroom is what governs latency.

**Level 2: The app server is the bottleneck now.**
Same graph plus the cache from level 1. Traffic raised to 900 rps. The DB is fine, the app server is saturated.
Allowed: `load_balancer`, `app_server`.
Teaches: horizontal scaling, and that fixing one bottleneck reveals the next.

**Level 3: Static assets are eating the app servers.**
Traffic mix shifted to 70/25/5. App servers are drowning in static file serving.
Allowed: `cdn`.
Teaches: not all traffic is the same, and offloading beats scaling.

**Level 4: Do it on a budget.**
A degraded system with a $150/month cap. The naive fix costs $200. The player must reach for the cheap high-leverage component instead of raw capacity.
Allowed: everything unlocked so far.
Teaches: cost as a first-class constraint.

**Level 5: Caching will not save you.**
Traffic mix 5/15/80, heavily write-dominated. The player will reflexively add a cache and watch nothing improve, because writes always reach the DB.
Allowed: everything, plus `read_replica`.
Teaches: know your workload before choosing a tool. This level should deliberately break the pattern established by levels 1 through 4.

### Level flow

1. Briefing modal with the scenario, the allowed node types, and the budget cap if any.
2. Editing unlocks the instant the briefing is dismissed — there is no locked "watch it fail" delay. The system still starts in its broken state, so the failure is visible immediately; the player is simply never prevented from acting on it. *(Amendment 1 — supersedes the original "the broken system runs live for a few seconds... before being allowed to touch anything... do not skip this" requirement.)*
3. Player edits the graph
4. Live re-simulation on every change, no separate "run" button
5. Win state fires when the condition holds for 3 consecutive seconds, followed by a short explainer of what happened and why. Winning does not lock the level: the player can dismiss the win modal via a secondary "play around in this level" action and keep editing/tinkering indefinitely; a persistent "Next level" affordance stays available once a level is solved so the player can advance whenever they choose, not only at the moment the modal first appears. Completion is recorded the instant the win condition first holds for 3s and is not revoked by subsequently breaking the fix while tinkering. The win modal itself is a one-time "you solved this" event per level — re-satisfying the condition on an already-solved level (e.g. break the fix, then re-fix it) must not show it again. *(Amendment 2.)*
6. Hints: at least 3 progressive hints are available on request (not forced), revealed one at a time, with the final hint being the concrete solution (exact nodes and wiring). *(Amendment 4.)*

---

## 5. UI requirements

- **Canvas**: React Flow with custom node components. Each node shows its type icon, a utilization bar that shifts green to amber to red, and its current latency.
- **Request particles**: a `<canvas>` layer behind the React Flow pane, animating dots travelling along edges. Dot density is proportional to RPS on that edge and colour-coded by traffic class. Drive it from a single `requestAnimationFrame` loop reading the sim state directly, never through React state.
- **HUD**: p99 latency, error rate, and monthly cost, always visible, each shown alongside its win-condition target so the player can see at a glance how close they are and what the current level actually asks for. *(Amendment 5.)*
- **Metrics panel**: rolling 30 second line chart of p99 latency, so the drop when a fix lands is visible as a cliff.
- **Palette**: draggable list of the node types allowed on the current level, each showing its cost. Also tap-to-add for touch devices where drag is impractical.
- **Inspector**: click a node to see and edit its config (cache hit ratio, server count).
- **Edge affordance**: every edge carries its own always-visible remove control at its midpoint (a thin dashed line is not a reliable click/tap target on its own). *(Amendment 6.)*
- **Help**: the level briefing (title, scenario, allowed node types, budget cap) can be reopened on demand at any point during play without resetting level state. *(Amendment 5.)*

### Mobile-safe from day one

This ships to phones later, so build these in now rather than retrofitting:

- Minimum 44px touch targets
- Never put information behind hover only. Tooltips open on tap.
- Support a **tap-to-connect** mode alongside drag-to-connect: tap source node, tap "connect", tap target
- Layout must survive a 390px viewport, with the inspector and palette collapsing into bottom sheets

---

## 6. Performance rules

- Run `tick()` at a fixed 10Hz. Render at 60fps by interpolating between sim states.
- Keep `SimState` out of React state. Store it in a Zustand store accessed via `getState()` inside the rAF loop.
- Only push slow-changing scalars (the HUD numbers, throttled to about 4Hz) into React render.
- Structure `tick()` so it can be moved into a Web Worker later without an API change.

---

## 7. Directory structure

```
src/
  sim/                 # pure TS, no React, no DOM
    types.ts
    nodeSpecs.ts
    engine.ts
    metrics.ts
    index.ts
  levels/
    types.ts
    level-01.ts ... level-05.ts
    index.ts
  store/
    gameStore.ts
    storage.ts
  components/
    canvas/
      GraphCanvas.tsx
      nodes/
      edges/
      ParticleLayer.tsx
    panels/
      Palette.tsx
      Inspector.tsx
      MetricsPanel.tsx
    hud/
    modals/
  App.tsx
capacitor.config.ts
```

---

## 8. Git discipline

**Commit continuously in small modules. Never batch work into a large commit. Ten commits for one module change is fine and preferred.**

Each commit should be a single coherent unit that builds. Use conventional commit prefixes. Run the test suite before each commit.

---

## 9. Explicitly out of scope

Do not build any of these, even if they seem natural:

- Campaign mode, idle/tycoon mode, or sandbox mode
- Any backend, API, user accounts, or cloud save
- Sound, music, or character art
- Analytics or telemetry
- Native iOS or Android builds. Add `capacitor.config.ts` and the Capacitor dependencies, but do not run `cap add`.

---

## 10. Definition of done

- `npm run dev` opens level 1 with a visibly failing system
- Dropping a cache node and wiring it between the app server and the DB causes the p99 latency chart to visibly collapse within two seconds
- All five levels are completable and each is completable **only** by the intended fix
- Level 5 cannot be won by adding a cache
- An empty or disconnected graph must never trivially satisfy a win condition
- `npm test` passes with the engine covered, including the saturation edge case at `u = 1`
- The whole UI is usable at a 390px viewport width
- `npm run build` produces a working static bundle ready for Firebase Hosting

---

## 11. Start here

Begin with `src/sim/` and its tests. Get the engine correct and proven before writing a single line of UI. When the tests confirm that adding a cache with a 0.8 hit ratio drops database utilization from 0.95 to roughly 0.35, then start on the canvas.

Ask before making any decision that contradicts the architectural rule in section 1. Any other decision that contradicts this spec should still be implemented as requested — but the contradicted section gets updated here, with the change logged below, rather than left to silently drift out of sync with the code.

---

## Amendments

1. **Intro lock removed.** Section 4's level flow originally required "the broken system runs live for a few seconds so the player sees and feels the failure before being allowed to touch anything... do not skip this... the pain is the pedagogy." Removed per explicit request: editing now unlocks the instant the briefing modal is dismissed, with no forced delay. The system still starts broken, so the failure is still visible immediately — the player is just never blocked from acting on it.
2. **Winning no longer locks the level.** Originally, satisfying the win condition (held 3s) was implicit terminal state. Per explicit request, winning now: (a) is dismissible via a "play around in this level" action that leaves the level fully editable, (b) surfaces a persistent "Next level" affordance once solved rather than forcing immediate advancement, (c) does not revoke completion if the player subsequently breaks their fix while tinkering, and (d) does not re-show the win modal on re-satisfying an already-solved level's condition.
3. **Traffic conservation / anti-exploit.** Found during testing, not originally specified: deleting all nodes (or disconnecting a subgraph) let a level trivially "win" because vanished traffic counted as neither a completion nor an error. Fixed by counting traffic with nowhere to go as errored. This required a routing refinement (specialized-vs-generic edge routing) so `read_replica` wired alongside `database` behaves correctly under the new check, and required giving level 3's starting graph a (previously absent, harmless) database node so its app_server's forwarded read/write traffic has somewhere to terminate.
4. **Hints added.** Not in the original spec. Per explicit request, every level now ships at least 3 progressive hints (observational → diagnostic → conceptual → concrete solution), revealed one at a time on request via a dedicated hint modal.
5. **HUD win-condition targets + reopenable briefing.** Not in the original spec. Per explicit request: the HUD shows each stat's target inline, and the level briefing can be reopened on demand via a persistent header button without resetting level state.
6. **Always-visible edge delete control.** Not in the original spec. Found during testing: a thin dashed edge line was not a reliable click/tap target for selecting-then-pressing-Delete. Every edge now carries its own always-visible remove button at its midpoint.
