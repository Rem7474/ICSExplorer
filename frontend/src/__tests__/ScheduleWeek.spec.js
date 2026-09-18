import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import ScheduleWeek from "../components/ScheduleWeek.vue";

describe("ScheduleWeek component", () => {
  it("renders safely without errors when events is empty array", () => {
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: [],
        currentWeekStart: new Date(),
        allEvents: [],
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("Pas de cours cette semaine");
  });

  it("renders safely when events is passed as a Vue Ref or reactive object", () => {
    const eventsRef = ref([]);
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: eventsRef,
        currentWeekStart: new Date(),
        allEvents: eventsRef,
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("Pas de cours cette semaine");
  });

  it("renders course events correctly", () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(8, 0, 0, 0);

    const endMonday = new Date(monday);
    endMonday.setHours(10, 0, 0, 0);

    const testEvents = [
      {
        uid: "evt-1",
        summary: "IN101 Programmation",
        start: monday,
        end: endMonday,
        location: "A166",
      },
    ];

    const wrapper = mount(ScheduleWeek, {
      props: {
        events: testEvents,
        currentWeekStart: monday,
        allEvents: testEvents,
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("IN101 Programmation");
  });

  it("handles multi-day events starting at a specific hour in the hourly grid and intermediate days in banner", () => {
    const monday = new Date(2026, 8, 14, 8, 0); // Mon Sep 14 2026
    const fridayStart = new Date(2026, 8, 18, 18, 0); // Fri Sep 18 18:00
    const sundayEnd = new Date(2026, 8, 20, 15, 0); // Sun Sep 20 15:00

    // WEI starts Friday at 18:00
    const weiEvent = {
      uid: "wei-2026",
      summary: "WEI",
      start: fridayStart,
      end: sundayEnd,
      categories: "CERCLE",
    };

    // AU530 spans Mon to Fri (intermediate days like Tue/Wed/Thu are all-day)
    const au530Event = {
      uid: "au530-full",
      summary: "AU530 Projet",
      start: new Date(2026, 8, 14, 0, 0),
      end: new Date(2026, 8, 18, 23, 59),
    };

    const testEvents = [weiEvent, au530Event];

    const wrapper = mount(ScheduleWeek, {
      props: {
        events: testEvents,
        currentWeekStart: monday,
        allEvents: testEvents,
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("WEI");
    expect(wrapper.text()).toContain("Cercle Esisar");

    // WEI starting at 18:00 on Friday should be rendered in the hourly grid as a timed event
    const timedEvents = wrapper.findAll(".day-schedule .event");
    expect(timedEvents.length).toBeGreaterThan(0);
    const weiCard = timedEvents.find((el) => el.text().includes("WEI"));
    expect(weiCard).toBeDefined();
    expect(weiCard.text()).toContain("18h00");

    // All-day multi-day event AU530 should appear in all-day banner
    expect(wrapper.find(".day-allday-container").exists()).toBe(true);
    const alldayBadges = wrapper.findAll(".allday-badge");
    expect(alldayBadges.length).toBeGreaterThan(0);
    expect(alldayBadges.some((b) => b.text().includes("AU530"))).toBe(true);
  });

  it("triggers datepicker showPicker and emits jumpToWeek on date selection", async () => {
    const monday = new Date(2026, 9, 19); // Oct 19 2026
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: [],
        currentWeekStart: monday,
        allEvents: [],
      },
    });

    const datePickerInput = wrapper.find(".week-date-picker");
    expect(datePickerInput.exists()).toBe(true);

    // Test change event on datepicker
    await datePickerInput.setValue("2026-11-02");
    await datePickerInput.trigger("change");

    expect(wrapper.emitted("jumpToWeek")).toBeTruthy();
    const emittedDate = wrapper.emitted("jumpToWeek")[0][0];
    expect(emittedDate.getFullYear()).toBe(2026);
    expect(emittedDate.getMonth()).toBe(10); // Nov (0-indexed 10)
    expect(emittedDate.getDate()).toBe(2);
  });

  it("handles keyboard shortcuts (ArrowLeft, ArrowRight, T)", async () => {
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: [],
        currentWeekStart: new Date(),
        allEvents: [],
      },
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(wrapper.emitted("prevWeek")).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(wrapper.emitted("nextWeek")).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
    expect(wrapper.emitted("currentWeek")).toBeTruthy();
  });

  it("resets activeDayIndex to 0 (Monday) and emits prevWeek/nextWeek when clicking week navigation arrows", async () => {
    const monday = new Date(2026, 8, 14); // Mon Sep 14 2026
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: [],
        currentWeekStart: monday,
        allEvents: [],
      },
    });

    // Simulate moving to Wednesday (index 2)
    wrapper.vm.scrollDayIntoView(2);
    expect(wrapper.vm.activeDayIndex).toBe(2);

    // Find previous and next week buttons
    const navButtons = wrapper.findAll(".nav-arrows button");
    const prevBtn = navButtons[0];
    const nextBtn = navButtons[navButtons.length - 1];

    // Click next week
    await nextBtn.trigger("click");
    expect(wrapper.emitted("nextWeek")).toBeTruthy();
    expect(wrapper.vm.activeDayIndex).toBe(0); // Reset to Monday!

    // Set to Friday (index 4) and click prev week
    wrapper.vm.scrollDayIntoView(4);
    await prevBtn.trigger("click");
    expect(wrapper.emitted("prevWeek")).toBeTruthy();
    expect(wrapper.vm.activeDayIndex).toBe(0); // Reset to Monday!
  });

  it("sets activeDayIndex to current day of week and emits currentWeek when clicking Aujourd'hui", async () => {
    const previousWeekMonday = new Date(2026, 0, 5); // Some past date
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: [],
        currentWeekStart: previousWeekMonday,
        allEvents: [],
      },
    });

    // Move to Friday
    wrapper.vm.scrollDayIntoView(4);

    const todayBtn = wrapper.find(".today-btn");
    expect(todayBtn.exists()).toBe(true);

    await todayBtn.trigger("click");
    expect(wrapper.emitted("currentWeek")).toBeTruthy();
    expect(wrapper.vm.activeDayIndex).toBe(wrapper.vm.getTodayDayIndex());
  });

  it("resets activeDayIndex to 0 and emits prevWeek/nextWeek on swipe boundaries", async () => {
    const monday = new Date(2026, 8, 14);
    const testEvents = [
      {
        uid: "evt-1",
        summary: "Test",
        start: monday,
        end: new Date(monday.getTime() + 3600000),
      },
    ];
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: testEvents,
        currentWeekStart: monday,
        allEvents: testEvents,
      },
    });

    const scheduleEl = wrapper.find(".schedule");
    expect(scheduleEl.exists()).toBe(true);

    // Swipe left on Friday (activeDayIndex = 4) -> next week and reset to Monday
    wrapper.vm.scrollDayIntoView(4);
    await scheduleEl.trigger("touchstart", {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    await scheduleEl.trigger("touchend", {
      changedTouches: [{ clientX: 100, clientY: 100 }], // dx = -100 (swipe left)
    });
    expect(wrapper.emitted("nextWeek")).toBeTruthy();
    expect(wrapper.vm.activeDayIndex).toBe(0);

    // Swipe right on Monday (activeDayIndex = 0) -> prev week and activeDayIndex is 4 (Vendredi)
    wrapper.vm.scrollDayIntoView(0);
    await scheduleEl.trigger("touchstart", {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    await scheduleEl.trigger("touchend", {
      changedTouches: [{ clientX: 200, clientY: 100 }], // dx = +100 (swipe right)
    });
    expect(wrapper.emitted("prevWeek")).toBeTruthy();
    expect(wrapper.vm.activeDayIndex).toBe(4);
  });

  it("supports swipe left and right on empty-state to navigate weeks", async () => {
    const monday = new Date(2026, 8, 14);
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: [],
        currentWeekStart: monday,
        allEvents: [],
      },
    });

    const emptyStateEl = wrapper.find(".empty-state");
    expect(emptyStateEl.exists()).toBe(true);

    // Swipe left -> nextWeek
    await emptyStateEl.trigger("touchstart", {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    await emptyStateEl.trigger("touchend", {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(wrapper.emitted("nextWeek")).toBeTruthy();

    // Swipe right -> prevWeek
    await emptyStateEl.trigger("touchstart", {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    await emptyStateEl.trigger("touchend", {
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });
    expect(wrapper.emitted("prevWeek")).toBeTruthy();
  });

  it("synchronizes activeDayIndex with horizontal scrolling", async () => {
    const monday = new Date(2026, 8, 14);
    const testEvents = [
      {
        uid: "evt-1",
        summary: "Test",
        start: monday,
        end: new Date(monday.getTime() + 3600000),
      },
    ];
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: testEvents,
        currentWeekStart: monday,
        allEvents: testEvents,
      },
    });

    const container = wrapper.find(".schedule").element;
    Object.defineProperty(container, "clientWidth", { value: 300, configurable: true });
    Object.defineProperty(container, "scrollWidth", { value: 1500, configurable: true });

    const groups = container.querySelectorAll(".day-group");
    groups.forEach((g, idx) => {
      Object.defineProperty(g, "offsetLeft", { value: idx * 300, configurable: true });
    });

    // Simulate scrolling to day 2 (Wednesday, offsetLeft = 600)
    container.scrollLeft = 600;
    wrapper.vm.onScheduleScroll();
    expect(wrapper.vm.activeDayIndex).toBe(2);

    // Simulate scrolling to day 4 (Friday, offsetLeft = 1200)
    container.scrollLeft = 1180;
    wrapper.vm.onScheduleScroll();
    expect(wrapper.vm.activeDayIndex).toBe(4);
  });

  it("jumps to next course date and sets activeDayIndex accordingly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 8, 0, 0));
    try {
      const monday = new Date(2026, 8, 14);
      // Next event is on Thursday at 10:00 (Sep 17 2026)
      const futureThursday = new Date(2026, 8, 17, 10, 0);
      const futureEvent = {
        uid: "future-1",
        summary: "Future Course",
        start: futureThursday,
        end: new Date(futureThursday.getTime() + 3600000),
      };

      const wrapper = mount(ScheduleWeek, {
        props: {
          events: [],
          currentWeekStart: monday,
          allEvents: [futureEvent],
        },
      });

      const jumpBtn = wrapper.find(".empty-state button");
      expect(jumpBtn.exists()).toBe(true);

      await jumpBtn.trigger("click");
      expect(wrapper.emitted("jumpToWeek")).toBeTruthy();
      expect(wrapper.vm.activeDayIndex).toBe(3); // Thursday is index 3
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the schedule-viewport wrapper and triggers directional transition classes", async () => {
    const monday = new Date(2026, 8, 14);
    const wrapper = mount(ScheduleWeek, {
      props: {
        events: [],
        currentWeekStart: monday,
        allEvents: [],
      },
    });

    const viewport = wrapper.find(".schedule-viewport");
    expect(viewport.exists()).toBe(true);

    // Clicking next week
    const navButtons = wrapper.findAll(".nav-arrows button");
    const prevBtn = navButtons[0];
    const nextBtn = navButtons[navButtons.length - 1];

    await nextBtn.trigger("click");
    expect(wrapper.emitted("nextWeek")).toBeTruthy();
    // In fallback mode (jsdom without startViewTransition)
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.transitionClass).toBe("anim-next");

    // Calling onAnimationEnd resets transitionClass
    wrapper.vm.onAnimationEnd();
    expect(wrapper.vm.transitionClass).toBe("");

    // Clicking prev week
    await prevBtn.trigger("click");
    expect(wrapper.emitted("prevWeek")).toBeTruthy();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.transitionClass).toBe("anim-prev");
  });

  it("sets document.documentElement data-nav-dir when startViewTransition is available", async () => {
    const monday = new Date(2026, 8, 14);
    let capturedCallback = null;
    let finishTransition;
    const mockStartViewTransition = vi.fn((cb) => {
      capturedCallback = cb;
      return {
        finished: new Promise((resolve) => {
          finishTransition = resolve;
        }),
      };
    });
    document.startViewTransition = mockStartViewTransition;

    try {
      const wrapper = mount(ScheduleWeek, {
        props: {
          events: [],
          currentWeekStart: monday,
          allEvents: [],
        },
      });

      const navButtons = wrapper.findAll(".nav-arrows button");
      const nextBtn = navButtons[navButtons.length - 1];

      await nextBtn.trigger("click");
      expect(mockStartViewTransition).toHaveBeenCalled();
      expect(document.documentElement.dataset.navDir).toBe("next");

      if (capturedCallback) {
        await capturedCallback();
      }

      // Finish transition and verify cleanup
      if (finishTransition) finishTransition();
      await new Promise((r) => setTimeout(r, 0));
      expect(document.documentElement.dataset.navDir).toBeUndefined();
    } finally {
      delete document.startViewTransition;
      delete document.documentElement.dataset.navDir;
    }
  });
});
