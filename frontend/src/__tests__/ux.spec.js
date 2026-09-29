import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { useScheduleLinks } from "../composables/useScheduleLinks.js";
import { useSchedule } from "../composables/useSchedule.js";
import { formatRelativeTime } from "../utils/dates.js";
import { router } from "../router/index.js";

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-28T12:00:00Z").getTime();

  it("formats compact French relative ages", () => {
    expect(formatRelativeTime(now - 20 * 1000, now)).toBe("à l'instant");
    expect(formatRelativeTime(now - 5 * 60000, now)).toBe("il y a 5 min");
    expect(formatRelativeTime(now - 2 * 3600000, now)).toBe("il y a 2 h");
    expect(formatRelativeTime(now - 3 * 86400000, now)).toBe("il y a 3 j");
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatRelativeTime(null, now)).toBe("");
    expect(formatRelativeTime("not a date", now)).toBe("");
  });
});

describe("schedule links", () => {
  it("offers a webcal subscription link for the current calendar", () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "student";
    schedule.selectedFile.value = "1A-Prépa-TP1.ics";
    const { webcalUrl } = useScheduleLinks(schedule);
    expect(webcalUrl.value).toMatch(/^webcal:\/\/.+\/output\/1A-Pr%C3%A9pa-TP1\.ics$/);
  });
});

describe("useSchedule UX state", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("attaches a configure action to personal-schedule errors instead of relying on message text", async () => {
    const schedule = useSchedule();
    await schedule.refreshPersonalSchedule();
    expect(schedule.statusAction.value).toBe("configure-personal");

    schedule.statusMessage.value = "Chargement de l'emploi du temps...";
    await flushPromises();
    expect(schedule.statusAction.value).toBeNull();
  });

  it("pushes a history entry when the user switches schedule, so Back returns to the previous one", async () => {
    // In the app, app.use(router) performs the initial navigation; do it here
    // too, since vue-router turns the very first navigation into a replace.
    await router.replace("/");
    const schedule = useSchedule();
    const pushSpy = vi.spyOn(window.history, "pushState");
    const events = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(events, { status: 200, headers: { "Content-Type": "text/calendar" } })
    );

    await schedule.loadSchedule("1A-Test.ics");
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toContain("file=1A-Test.ics");

    // Reloading the same schedule does not stack duplicate entries.
    await schedule.loadSchedule("1A-Test.ics");
    expect(pushSpy).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it("restores the previous schedule when the user presses Back", async () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Test.ics", "2A-Test.ics"];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR", { status: 200 })
    );
    // Background listeners (incl. popstate) are installed by startHealthPolling, as in init().
    schedule.startHealthPolling(60 * 60 * 1000);
    try {
      await schedule.loadSchedule("1A-Test.ics");
      await schedule.loadSchedule("2A-Test.ics");
      expect(schedule.selectedFile.value).toBe("2A-Test.ics");

      window.history.replaceState({}, "", "/?file=1A-Test.ics");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await flushPromises();
      await vi.waitFor(() => expect(schedule.selectedFile.value).toBe("1A-Test.ics"));
      expect(schedule.selectedMode.value).toBe("student");
    } finally {
      schedule.stopHealthPolling();
      vi.restoreAllMocks();
    }
  });
});
