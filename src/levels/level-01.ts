import { createNodeSpec } from "../sim";
import type { Level } from "./types";

const client = createNodeSpec("client", "client");
const appServer = createNodeSpec("app_server", "app_server", { capacityRps: 1000 });
const database = createNodeSpec("database", "database");

export const level01: Level = {
  id: "level-01",
  title: "The database is on fire",
  briefing:
    "This system serves 400 requests per second: mostly reads, a few writes, a little static. " +
    "The database is drowning — every read that could have been served from memory is hammering disk instead. " +
    "Give it somewhere to absorb repeat reads before they ever reach the database.",
  explainer:
    "A cache with an 80% hit ratio means only 1 in 5 reads still reaches the database — and utilization isn't " +
    "linear with load, so cutting that traffic doesn't just shave latency a little, it collapses it. That's the " +
    "whole lesson: headroom under capacity is what actually governs latency, not the raw request count.",
  hints: [
    "Look at the database's utilization bar — it's deep red. What's eating its capacity?",
    "Most of this traffic is reads. Reads that hit the same data over and over don't need to go all the way to disk every single time.",
    "Something that sits between the app server and the database, remembering recent reads, would take a lot of that load off.",
    "Drag a Cache onto the canvas. Delete the direct app_server → database edge, then wire app_server → cache → database instead. The default 80% hit ratio is enough.",
  ],
  startingGraph: {
    nodes: [client, appServer, database],
    edges: [
      { id: "e-client-app", source: client.id, target: appServer.id },
      { id: "e-app-db", source: appServer.id, target: database.id },
    ],
  },
  trafficProfile: { totalRps: 400, mix: { static: 0.1, read: 0.85, write: 0.05 } },
  allowedNodeTypes: ["cache"],
  winCondition: { maxP99Ms: 300, maxErrorRate: 0.05 },
};
