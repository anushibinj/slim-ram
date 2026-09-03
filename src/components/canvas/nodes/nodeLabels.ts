import type { NodeType } from "../../../sim";

export const NODE_LABELS: Record<NodeType, string> = {
  client: "Client",
  app_server: "App Server",
  database: "Database",
  cache: "Cache",
  load_balancer: "Load Balancer",
  cdn: "CDN",
  read_replica: "Read Replica",
};
