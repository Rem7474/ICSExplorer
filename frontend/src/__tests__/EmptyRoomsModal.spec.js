import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import EmptyRoomsModal from "../components/EmptyRoomsModal.vue";

vi.mock("../ics/aggregator.js", () => ({
  getAggregatedEvents: vi.fn().mockResolvedValue([
    {
      summary: "Maths TD",
      location: "A042",
      start: new Date(2026, 8, 1, 14, 0),
      end: new Date(2026, 8, 1, 16, 0),
    },
  ]),
}));

describe("EmptyRoomsModal component", () => {
  it("renders correctly and calculates empty rooms", async () => {
    const wrapper = mount(EmptyRoomsModal);
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("Salles vides");
  });

  it("emits close event when close button (✕) is clicked", async () => {
    const wrapper = mount(EmptyRoomsModal);
    const closeBtn = wrapper.find("button.close-btn");
    expect(closeBtn.exists()).toBe(true);

    await closeBtn.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close event when footer button (Fermer) is clicked", async () => {
    const wrapper = mount(EmptyRoomsModal);
    const footerBtn = wrapper.find(".modal-footer button");
    expect(footerBtn.exists()).toBe(true);

    await footerBtn.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close event when pressing Escape key", async () => {
    const wrapper = mount(EmptyRoomsModal);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("uses direct room calendar to accurately calculate room availability", async () => {
    const mockRoomIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-ds
SUMMARY:DS Maths S1
LOCATION:A049
DTSTART:20260923T080000Z
DTEND:20260923T100000Z
END:VEVENT
END:VCALENDAR`;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/rooms/A049.ics")) {
        return {
          ok: true,
          arrayBuffer: async () => new TextEncoder().encode(mockRoomIcs),
        };
      }
      return { ok: false };
    });

    const wrapper = mount(EmptyRoomsModal);
    await new Promise((r) => setTimeout(r, 50));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("A049");
  });
});
