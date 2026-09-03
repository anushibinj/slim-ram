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
  /**
   * Progressive nudges toward the fix, revealed one at a time on request.
   * At least 3 entries; the last one is the solution itself.
   */
  hints: string[];
  startingGraph: SimGraph;
  trafficProfile: TrafficProfile;
  allowedNodeTypes: NodeType[];
  budgetCap?: number;
  winCondition: WinCondition;
}
