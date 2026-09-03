/**
 * Small adapter over persistent key-value storage. Progress reads/writes go
 * through this instead of calling `localStorage` directly so the backing
 * store can swap to Capacitor Preferences for native builds later without
 * touching call sites.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (private browsing, quota) — progress
      // just won't persist this session, which isn't worth surfacing.
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // See setItem.
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();

export interface GameProgress {
  completedLevelIds: string[];
  currentLevelId: string;
}

const PROGRESS_KEY = "slim-ram:progress:v1";

export function loadProgress(defaultLevelId: string): GameProgress {
  const raw = storage.getItem(PROGRESS_KEY);
  if (!raw) return { completedLevelIds: [], currentLevelId: defaultLevelId };
  try {
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    return {
      completedLevelIds: Array.isArray(parsed.completedLevelIds) ? parsed.completedLevelIds : [],
      currentLevelId: typeof parsed.currentLevelId === "string" ? parsed.currentLevelId : defaultLevelId,
    };
  } catch {
    return { completedLevelIds: [], currentLevelId: defaultLevelId };
  }
}

export function saveProgress(progress: GameProgress): void {
  storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}
