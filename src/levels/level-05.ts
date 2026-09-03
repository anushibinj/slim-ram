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
  explainer:
    "A cache only ever touches reads, and reads were never the problem here — 80% of this traffic is writes, " +
    "and every one of them still has to reach the database no matter what you put in front of it. Routing reads " +
    "to a read_replica instead frees up the primary database's full capacity for writes alone, which is just " +
    "enough headroom to fit. The lesson: know your workload before you reach for a tool that only helps one " +
    "slice of it.",
  hints: [
    "Go ahead, try the cache — it's fixed everything so far. Watch the database's utilization bar closely after you wire it in.",
    "This traffic is 80% writes. A cache only ever helps reads — writes always pass straight through to the database no matter what sits in front of it.",
    "You need something that takes read traffic off the primary database entirely, freeing its full capacity for writes alone.",
    "Add a Read Replica and wire app_server → read_replica alongside the existing app_server → database edge. Reads route to the replica, writes stay on the primary — just enough headroom for writes alone to fit.",
  ],
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
