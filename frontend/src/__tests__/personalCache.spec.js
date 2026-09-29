import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { usePersonalStore } from "../stores/personal.js";
import { PERSONAL_CACHE_KEY } from "../stores/storage.js";

// In-memory IndexedDB stand-in; `available` simulates browsers without it.
const kv = new Map();
let available = true;
vi.mock("../utils/kvStore.js", () => {
  const guard = (fn) => (...args) => (available ? Promise.resolve(fn(...args)) : Promise.reject(new Error("no idb")));
  return {
    kvGet: guard((k) => kv.get(k)),
    kvSet: guard((k, v) => void kv.set(k, v)),
    kvDelete: guard((k) => void kv.delete(k)),
  };
});

const ICS = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";

describe("personal calendar cache", () => {
  beforeEach(() => {
    kv.clear();
    available = true;
    localStorage.clear();
  });

  it("keeps the calendar in IndexedDB, not localStorage", async () => {
    const personal = usePersonalStore();
    personal.remember(ICS, { name: "Groupe 1" });
    await flushPromises();
    expect(kv.get(PERSONAL_CACHE_KEY)).toBe(ICS);
    expect(localStorage.getItem(PERSONAL_CACHE_KEY)).toBeNull();
    expect(personal.getCachedIcs()).toBe(ICS);
  });

  it("moves an older localStorage copy to IndexedDB on start-up", async () => {
    localStorage.setItem(PERSONAL_CACHE_KEY, ICS);
    const personal = usePersonalStore();
    await personal.hydrate();
    expect(kv.get(PERSONAL_CACHE_KEY)).toBe(ICS);
    expect(localStorage.getItem(PERSONAL_CACHE_KEY)).toBeNull();
    expect(personal.getCachedIcs()).toBe(ICS);
  });

  it("restores the calendar from IndexedDB after a restart", async () => {
    kv.set(PERSONAL_CACHE_KEY, ICS);
    const personal = usePersonalStore();
    expect(personal.getCachedIcs()).toBeNull();
    await personal.hydrate();
    expect(personal.getCachedIcs()).toBe(ICS);
  });

  it("falls back to localStorage without IndexedDB", async () => {
    available = false;
    const personal = usePersonalStore();
    personal.remember(ICS);
    await flushPromises();
    expect(localStorage.getItem(PERSONAL_CACHE_KEY)).toBe(ICS);
    await personal.hydrate();
    expect(personal.getCachedIcs()).toBe(ICS);
  });

  it("forgets it everywhere", async () => {
    const personal = usePersonalStore();
    personal.remember(ICS);
    await flushPromises();
    personal.forget();
    await flushPromises();
    expect(kv.has(PERSONAL_CACHE_KEY)).toBe(false);
    expect(personal.getCachedIcs()).toBeNull();
  });
});
