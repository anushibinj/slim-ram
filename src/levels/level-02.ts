import { createNodeSpec } from "../sim";
import type { Level } from "./types";

const client = createNodeSpec("client", "client");
const appServer = createNodeSpec("app_server", "app_server");
const cache = createNodeSpec("cache", "cache");
const database = createNodeSpec("database", "database", { capacityRps: 220 });

export const level02: Level = {
  id: "level-02",
  title: "The app server is the bottleneck now",
  briefing:
    "Last level's fix worked — the database is fine. But traffic has grown to 900 requests per second, " +
    "and now the single app server can't keep up with the volume passing through it. Scale the tier that's " +
    "actually struggling.",
  explainer:
    "Caching fixed the database, but it did nothing for the app server — every request still has to pass " +
    "through it first. Spreading that load across several instances behind a load balancer is what brought its " +
    "utilization back under capacity. Fixing one bottleneck just moves the constraint to whatever's next in line.",
  hints: [
    "Check every node's utilization bar. The database's fix from last level is holding fine — but something else is now deep red.",
    "Traffic grew from 400 to 900rps, but a single app server only has 200rps of capacity. It doesn't matter how good the cache is if requests never make it past the app server.",
    "You need more application capacity — either several app server instances, or something that fans traffic out evenly across them.",
    "Add a Load Balancer and a few more App Server instances behind it (or just raise the existing App Server's 'server count' in the Inspector to 5) so combined capacity clears 900rps.",
  ],
  startingGraph: {
    nodes: [client, appServer, cache, database],
    edges: [
      { id: "e-client-app", source: client.id, target: appServer.id },
      { id: "e-app-cache", source: appServer.id, target: cache.id },
      { id: "e-cache-db", source: cache.id, target: database.id },
    ],
  },
  trafficProfile: { totalRps: 900, mix: { static: 0.1, read: 0.85, write: 0.05 } },
  allowedNodeTypes: ["load_balancer", "app_server"],
  winCondition: { maxP99Ms: 1000, maxErrorRate: 0.05 },
};
