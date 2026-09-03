import { level01 } from "./level-01";
import { level02 } from "./level-02";
import { level03 } from "./level-03";
import { level04 } from "./level-04";
import { level05 } from "./level-05";
import type { Level } from "./types";

export type { Level, WinCondition } from "./types";

export const LEVELS: Level[] = [level01, level02, level03, level04, level05];

export function getLevelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getNextLevelId(id: string): string | undefined {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index === -1 || index === LEVELS.length - 1) return undefined;
  return LEVELS[index + 1].id;
}
