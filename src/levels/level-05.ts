import { createNodeSpec } from "../sim";
import type { Level } from "./types";

const client = createNodeSpec("client", "client");
const appServer = createNodeSpec("app_server", "app_server", { capacityRps: 1000 });
const database = createNodeSpec("database", "database");

export const level05: Level = {
  id: "level-05",
  title: "Caching will not save you",
  briefing:
    "This workload is 80% writes. Go ahead, add a cache — it's what fixed every other level. Watch how " +
    "little it moves the needle. Writes always reach the database; no cache in the world changes that. " +
    "You need to know what kind of traffic you actually have before you reach for a tool.",
  startingGraph: {
    nodes: [client, appServer, database],
    edges: [
      { id: "e-client-app", source: client.id, target: appServer.id },
      { id: "e-app-db", source: appServer.id, target: database.id },
    ],
  },
  trafficProfile: { totalRps: 184, mix: { static: 0.05, read: 0.15, write: 0.8 } },
  allowedNodeTypes: ["cache", "load_balancer", "app_server", "cdn", "read_replica"],
  winCondition: { maxP99Ms: 2000, maxErrorRate: 0.01 },
};
