import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTheme, _resetThemeForTesting } from "../composables/useTheme.js";

describe("useTheme composable", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark-mode");
    vi.useRealTimers();
    _resetThemeForTesting();
  });

  it("provides isDark ref and toggleTheme function", () => {
    const { isDark, toggleTheme } = useTheme();
    expect(typeof isDark.value).toBe("boolean");
    expect(typeof toggleTheme).toBe("function");
  });

  it("toggles isDark value", () => {
    const { isDark, toggleTheme } = useTheme();
    const initial = isDark.value;
    toggleTheme();
    expect(isDark.value).toBe(!initial);
  });

  it("ignores rapid consecutive toggles (ghost click debounce on touch/tablets)", () => {
    const { isDark, toggleTheme } = useTheme();
    const initial = isDark.value;

    // First tap
    toggleTheme();
    expect(isDark.value).toBe(!initial);

    // Rapid second tap / ghost click (within cooldown)
    toggleTheme();
    // Must remain the same, not revert!
    expect(isDark.value).toBe(!initial);
  });

  it("allows toggling again after cooldown window expires", async () => {
    vi.useFakeTimers();
    const { isDark, toggleTheme } = useTheme();
    const initial = isDark.value;

    // First toggle
    toggleTheme();
    expect(isDark.value).toBe(!initial);

    // Advance past cooldown (350ms)
    vi.advanceTimersByTime(400);

    // Second toggle
    toggleTheme();
    expect(isDark.value).toBe(initial);

    vi.useRealTimers();
  });

  it("synchronizes class on document.documentElement", async () => {
    vi.useFakeTimers();
    const { isDark, toggleTheme } = useTheme();

    if (!isDark.value) {
      toggleTheme();
    }
    expect(document.documentElement.classList.contains("dark-mode")).toBe(true);

    vi.advanceTimersByTime(400);
    toggleTheme();
    expect(document.documentElement.classList.contains("dark-mode")).toBe(false);

    vi.useRealTimers();
  });

  it("handles localStorage security / quota exceptions gracefully without throwing", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError or SecurityError in private mode");
    });

    const { toggleTheme } = useTheme();
    expect(() => toggleTheme()).not.toThrow();

    setItemSpy.mockRestore();
  });
});
