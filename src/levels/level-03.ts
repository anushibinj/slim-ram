import { createNodeSpec } from "../sim";
import type { Level } from "./types";

const client = createNodeSpec("client", "client");
const appServer = createNodeSpec("app_server", "app_server");

export const level03: Level = {
  id: "level-03",
  title: "Static assets are eating the app servers",
  briefing:
    "The traffic mix has shifted: 70% of requests are now static assets — JS, CSS, images. The app server " +
    "serves those itself, and it's drowning in files that never needed to touch application code at all. " +
    "Not all traffic is the same; some of it shouldn't even get this far.",
  explainer:
    "A CDN absorbs static traffic entirely — it never even reaches the app server. That's not the same trick as " +
    "caching or scaling: the app server didn't get faster or bigger, most of its work simply stopped being its " +
    "problem. Knowing which traffic class you're looking at changes which fix even makes sense.",
  startingGraph: {
    nodes: [client, appServer],
    edges: [{ id: "e-client-app", source: client.id, target: appServer.id }],
  },
  trafficProfile: { totalRps: 500, mix: { static: 0.7, read: 0.25, write: 0.05 } },
  allowedNodeTypes: ["cdn"],
  winCondition: { maxP99Ms: 100, maxErrorRate: 0.05 },
};
