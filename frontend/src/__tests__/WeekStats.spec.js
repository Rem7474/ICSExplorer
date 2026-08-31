import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import WeekStats from "../components/WeekStats.vue";

describe("WeekStats component", () => {
  it("handles empty events safely without errors", () => {
    const wrapper = mount(WeekStats, {
      props: { events: [] },
    });
    expect(wrapper.exists()).toBe(true);
  });

  it("handles events passed as Vue Ref safely without crashing", () => {
    const eventsRef = ref([]);
    const wrapper = mount(WeekStats, {
      props: { events: eventsRef },
    });
    expect(wrapper.exists()).toBe(true);
  });

  it("calculates total hours and groups subjects properly", () => {
    const start = new Date(2026, 8, 1, 8, 0);
    const end = new Date(2026, 8, 1, 10, 0); // 2 hours
    const testEvents = [
      { summary: "IN101 Algo", start, end },
      { summary: "SN201 Signal", start, end },
    ];

    const wrapper = mount(WeekStats, {
      props: { events: testEvents },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("Total : 4.0h");
    expect(wrapper.text()).toContain("IN");
    expect(wrapper.text()).toContain("SN");
  });
});
