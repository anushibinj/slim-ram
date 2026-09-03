import type { NodeType, SimGraph, TrafficProfile } from "../sim";

export interface WinCondition {
  maxP99Ms?: number;
  maxErrorRate?: number;
  maxMonthlyCost?: number;
}

export interface Level {
  id: string;
  title: string;
  briefing: string;
  /** Shown once the win condition holds for 3 seconds — what happened and why. */
  explainer: string;
  startingGraph: SimGraph;
  trafficProfile: TrafficProfile;
  allowedNodeTypes: NodeType[];
  budgetCap?: number;
  winCondition: WinCondition;
}
