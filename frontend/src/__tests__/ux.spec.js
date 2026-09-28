import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ScheduleControls from "../components/ScheduleControls.vue";
import ScheduleWeek from "../components/ScheduleWeek.vue";
import { useSchedule } from "../composables/useSchedule.js";
import { formatRelativeTime, getWeekStart } from "../utils/dates.js";
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

describe("quick search", () => {
  const mountWithFiles = () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Prépa-TP1.ics", "1A-Prépa-TP2.ics", "3A-IR-IR1.ics"];
    schedule.availableTeachers.value = ["DUPONT Jean"];
    schedule.availableRooms.value = ["A042"];
    schedule.loadSchedule = vi.fn();
    const wrapper = mount(ScheduleControls, { props: { schedule }, attachTo: document.body });
    return { schedule, wrapper, input: wrapper.find("#quickSearchInput") };
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("exposes an accessible combobox with a label", () => {
    const { wrapper, input } = mountWithFiles();
    expect(wrapper.find('label[for="quickSearchInput"]').exists()).toBe(true);
    expect(input.attributes("role")).toBe("combobox");
    expect(input.attributes("aria-expanded")).toBe("false");
  });

  it("navigates results with the keyboard and selects with Enter", async () => {
    const { schedule, input } = mountWithFiles();
    await input.trigger("focus");
    await input.setValue("Prépa");
    expect(input.attributes("aria-expanded")).toBe("true");

    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(input.attributes("aria-activedescendant")).toBe("quick-search-option-1");
    expect(document.querySelector("#quick-search-option-1").getAttribute("aria-selected")).toBe("true");

    await input.trigger("keydown", { key: "Enter" });
    expect(schedule.loadSchedule).toHaveBeenCalledWith("1A-Prépa-TP2.ics");
  });

  it("closes with Escape and shows a no-result message", async () => {
    const { wrapper, input } = mountWithFiles();
    await input.trigger("focus");
    await input.setValue("zzz-introuvable");
    expect(wrapper.find(".search-dropdown").text()).toContain("Aucun résultat");

    await input.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".search-dropdown").exists()).toBe(false);
  });

  it("closes the dropdown on blur (regression: setTimeout was called from the template)", async () => {
    vi.useFakeTimers();
    try {
      const { wrapper, input } = mountWithFiles();
      await input.trigger("focus");
      await input.setValue("Prépa");
      expect(wrapper.find(".search-dropdown").exists()).toBe(true);

      await input.trigger("blur");
      vi.advanceTimersByTime(200);
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".search-dropdown").exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not download every calendar just because the field got focus", async () => {
    const schedule = useSchedule();
    schedule.loadTeacherList = vi.fn();
    schedule.loadRoomList = vi.fn();
    const wrapper = mount(ScheduleControls, { props: { schedule } });
    const input = wrapper.find("#quickSearchInput");

    await input.trigger("focus");
    expect(schedule.loadTeacherList).not.toHaveBeenCalled();

    await input.setValue("DU");
    expect(schedule.loadTeacherList).toHaveBeenCalledTimes(1);
    expect(schedule.loadRoomList).toHaveBeenCalledTimes(1);
  });

  it("shows indexing progress while the teacher/room index is built", async () => {
    const schedule = useSchedule();
    schedule.loadTeacherList = vi.fn();
    schedule.loadRoomList = vi.fn();
    schedule.isAggregatorLoading.value = true;
    schedule.indexProgress.value = { loaded: 12, total: 48 };
    const wrapper = mount(ScheduleControls, { props: { schedule } });
    const input = wrapper.find("#quickSearchInput");
    await input.trigger("focus");
    await input.setValue("DU");

    expect(wrapper.find(".search-status").text()).toContain("12/48");
  });

  it("offers a webcal subscription link for the current calendar", () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "student";
    schedule.selectedFile.value = "1A-Prépa-TP1.ics";
    const wrapper = mount(ScheduleControls, { props: { schedule } });
    const link = wrapper.find("a.btn-subscribe");
    expect(link.exists()).toBe(true);
    expect(link.attributes("href")).toMatch(/^webcal:\/\/.+\/output\/1A-Pr%C3%A9pa-TP1\.ics$/);
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

describe("ScheduleWeek accessibility", () => {
  it("describes each course for screen readers", () => {
    const monday = getWeekStart(new Date());
    const start = new Date(monday);
    start.setHours(8, 15, 0, 0);
    const end = new Date(monday);
    end.setHours(10, 15, 0, 0);

    const events = [{ uid: "1", summary: "Algorithmique", location: "A042", start, end }];
    const wrapper = mount(ScheduleWeek, { props: { events, allEvents: events, currentWeekStart: monday } });

    const label = wrapper.find(".event").attributes("aria-label");
    expect(label).toContain("Algorithmique");
    expect(label).toContain("08h15 - 10h15");
    expect(label).toContain("salle A042");
  });
});

describe("mobile toolbar", () => {
  it("keeps an accessible name on every button that becomes icon-only on phones", () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Prépa-TP1.ics"];
    schedule.selectedMode.value = "student";
    schedule.selectedFile.value = "1A-Prépa-TP1.ics";
    schedule.selectedType.value = "TP1";
    const wrapper = mount(ScheduleControls, { props: { schedule } });

    for (const sel of [".btn-pin", ".btn-copy-link", ".btn-subscribe", ".btn-share", ".btn-load-action"]) {
      const el = wrapper.find(sel);
      expect(el.exists(), sel).toBe(true);
      expect(el.attributes("aria-label"), sel).toBeTruthy();
    }
    expect(wrapper.findAll(".mode-tab-btn").map((t) => t.find(".tab-label-mobile, span:not(.tab-label-desktop)").exists())).toEqual([true, true, true, true]);
  });
});
