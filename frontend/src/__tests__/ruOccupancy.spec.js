import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import RuOccupancy from "../components/planning/RuOccupancy.vue";

const report = (overrides = {}) => ({
  current: { served: 849, capacity: 850, remaining: 1, updatedAt: new Date().toISOString() },
  today: [
    { t: "2026-10-19T10:00:00Z", served: 100, capacity: 850 },
    { t: "2026-10-19T11:00:00Z", served: 849, capacity: 850 },
  ],
  history: [
    { date: "2026-10-15", served: 700, capacity: 850 },
    { date: "2026-10-16", served: 650, capacity: 850 },
  ],
  ...overrides,
});

const mockFetch = (body, ok = true) => {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok, json: async () => body });
};

describe("RuOccupancy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows served/remaining counts, today's curve and the daily history", async () => {
    mockFetch(report());
    const wrapper = mount(RuOccupancy);
    await flushPromises();

    expect(wrapper.text()).toContain("849");
    expect(wrapper.text()).toContain("restants");
    expect(wrapper.findAll("svg")).toHaveLength(2);
    expect(wrapper.findAll("rect.bar")).toHaveLength(2);
    expect(wrapper.text()).toContain("moyenne 675");
  });

  it("only shows the history when the meal is not today", async () => {
    mockFetch(report());
    const wrapper = mount(RuOccupancy, { props: { day: new Date(2020, 0, 1) } });
    await flushPromises();

    expect(wrapper.text()).not.toContain("repas servis");
    expect(wrapper.findAll("rect.bar")).toHaveLength(2);
  });

  it("renders nothing when the API is unavailable", async () => {
    mockFetch({}, false);
    const wrapper = mount(RuOccupancy);
    await flushPromises();

    expect(wrapper.find(".ru-occupancy").exists()).toBe(false);
  });
});
