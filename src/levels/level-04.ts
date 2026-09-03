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
  explainer:
    "Scaling out app servers works, but every extra instance costs money — enough of them to fix this blows " +
    "straight through the cap. A single cdn costs a fraction as much and removes the actual source of the load " +
    "instead of just adding capacity to absorb it. Cost is a constraint like any other; the cheapest fix that " +
    "actually works beats the obvious one.",
  hints: [
    "This looks like the static-traffic problem again — but this time watch the cost figure in the HUD, not just p99.",
    "Scaling out the app server tier (a load balancer plus several instances) does fix the latency — check what it does to the monthly cost against the $150 cap.",
    "The cheapest fix isn't more capacity. It's removing the traffic that never needed to reach the app server at all.",
    "Add a single CDN in front of the app server ($10/mo). It fixes latency the same way as before, and total cost lands around $110/mo — comfortably under budget.",
  ],
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
