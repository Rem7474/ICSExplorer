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

  it("handles multi-day events (e.g., weekend integration WEI) gracefully without overflowing", () => {
    const monday = new Date(2026, 8, 14, 8, 0); // Mon Sep 14 2026
    const fridayStart = new Date(2026, 8, 18, 18, 0); // Fri Sep 18 18:00
    const sundayEnd = new Date(2026, 8, 20, 15, 0); // Sun Sep 20 15:00

    const testEvents = [
      {
        uid: "wei-2026",
        summary: "WEI",
        start: fridayStart,
        end: sundayEnd,
        categories: "CERCLE",
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
    expect(wrapper.text()).toContain("WEI");
    expect(wrapper.text()).toContain("Cercle Esisar");
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
});
