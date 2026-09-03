import { createNodeSpec } from "../sim";
import type { Level } from "./types";

const client = createNodeSpec("client", "client");
const appServer = createNodeSpec("app_server", "app_server");
const database = createNodeSpec("database", "database", { capacityRps: 1000 });

export const level04: Level = {
  id: "level-04",
  title: "Do it on a budget",
  briefing:
    "This system is degraded and traffic is heavily static again — but this time there's a budget: " +
    "$150 a month, total. Throwing raw capacity at the problem will fix the symptom, but it won't fit the " +
    "budget. Find the cheap, high-leverage fix instead of the expensive brute-force one.",
  startingGraph: {
    nodes: [client, appServer, database],
    edges: [
      { id: "e-client-app", source: client.id, target: appServer.id },
      { id: "e-app-db", source: appServer.id, target: database.id },
    ],
  },
  trafficProfile: { totalRps: 500, mix: { static: 0.65, read: 0.3, write: 0.05 } },
  allowedNodeTypes: ["cache", "load_balancer", "app_server", "cdn"],
  budgetCap: 150,
  winCondition: { maxP99Ms: 300, maxErrorRate: 0.05, maxMonthlyCost: 150 },
};
