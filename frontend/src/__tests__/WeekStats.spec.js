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
    expect(wrapper.text()).toContain("Total semaine : 4.0h");
    expect(wrapper.text()).toContain("IN");
    expect(wrapper.text()).toContain("SN");
    expect(wrapper.text()).toContain("Informatique");
  });

  it("emits filter when a subject chip is clicked", async () => {
    const start = new Date(2026, 8, 1, 8, 0);
    const end = new Date(2026, 8, 1, 10, 0);
    const testEvents = [{ summary: "IN101 Algo", start, end }];

    const wrapper = mount(WeekStats, {
      props: { events: testEvents },
    });

    const chip = wrapper.find(".chip");
    expect(chip.exists()).toBe(true);
    await chip.trigger("click");

    expect(wrapper.emitted("filter")).toBeTruthy();
    expect(wrapper.emitted("filter")[0]).toEqual(["IN"]);
  });

  it("applies is-disabled class and recalculates active hours when subject is in disabledSubjects", async () => {
    const start = new Date(2026, 8, 1, 8, 0);
    const end = new Date(2026, 8, 1, 10, 0);
    const testEvents = [
      { summary: "IN101 Algo", start, end },
      { summary: "SN201 Signal", start, end },
    ];

    const wrapper = mount(WeekStats, {
      props: {
        events: testEvents,
        disabledSubjects: ["IN"],
      },
    });

    // Active hours is 2.0h (out of 4.0h)
    expect(wrapper.text()).toContain("2.0h");
    expect(wrapper.text()).toContain("sur 4.0h");
    expect(wrapper.text()).toContain("1 matière masquée");

    const chips = wrapper.findAll(".chip");
    const inChip = chips.find((c) => c.text().includes("IN"));
    expect(inChip.classes()).toContain("is-disabled");

    // Click reset button
    const resetBtn = wrapper.find(".clear-filter-btn");
    expect(resetBtn.exists()).toBe(true);
    await resetBtn.trigger("click");
    expect(wrapper.emitted("reset")).toBeTruthy();
  });
});
