import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProgress, saveProgress, storage } from "./storage";

function fakeLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe("storage adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("degrades to no-ops when localStorage is unavailable, instead of throwing", () => {
    expect(() => storage.setItem("k", "v")).not.toThrow();
    expect(storage.getItem("k")).toBeNull();
    expect(() => storage.removeItem("k")).not.toThrow();
  });

  it("round-trips game progress through localStorage when available", () => {
    vi.stubGlobal("localStorage", fakeLocalStorage());

    expect(loadProgress("level-01")).toEqual({ completedLevelIds: [], currentLevelId: "level-01" });

    saveProgress({ completedLevelIds: ["level-01", "level-02"], currentLevelId: "level-03" });
    expect(loadProgress("level-01")).toEqual({ completedLevelIds: ["level-01", "level-02"], currentLevelId: "level-03" });
  });

  it("falls back to defaults on corrupted stored JSON", () => {
    const fake = fakeLocalStorage();
    fake.setItem("slim-ram:progress:v1", "{not json");
    vi.stubGlobal("localStorage", fake);

    expect(loadProgress("level-01")).toEqual({ completedLevelIds: [], currentLevelId: "level-01" });
  });
});
