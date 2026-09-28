import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h } from "vue";
import { VApp } from "vuetify/components";
import FreeRoomsView from "../views/FreeRoomsView.vue";
import { useScheduleStore } from "../stores/schedule.js";
import { computeFreeRooms, toDateInput, toTimeInput, KNOWN_ROOMS } from "../composables/useFreeRooms.js";

vi.mock("../ics/aggregator.js", () => ({ getAggregatedEvents: vi.fn().mockResolvedValue([]) }));

const at = (h, m = 0, day = 28) => new Date(2026, 8, day, h, m);
const ev = (from, to) => ({ start: from, end: to });

describe("computeFreeRooms", () => {
  const target = at(14);

  it("drops busy rooms and says until when the others stay free", () => {
    const rooms = computeFreeRooms(
      new Map([
        ["B040", [ev(at(13), at(15))]], // busy
        ["A042", [ev(at(16), at(18))]], // free until 16h
        ["A166", [ev(at(8), at(10)), ev(at(9, 0, 29), at(10, 0, 29))]], // free, next course tomorrow
      ]),
      target
    );
    expect(rooms.map((r) => r.room)).toEqual(["A042", "A166"]);
    expect(rooms[0]).toMatchObject({ building: "A", isLimited: true, availabilityText: "Libre jusqu'à 16h00" });
    expect(rooms[1]).toMatchObject({ isLimited: false, availabilityText: "Libre le reste de la journée" });
  });

  it("a course ending exactly now leaves the room free", () => {
    expect(computeFreeRooms(new Map([["A042", [ev(at(12), at(14))]]]), target)).toHaveLength(1);
  });

  it("formats local dates and quarter hours for the native inputs", () => {
    expect(toDateInput(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toTimeInput(new Date(2026, 0, 5, 9, 44))).toBe("09:30");
  });
});

describe("FreeRoomsView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(14, 5));
    const calendar = (start, end) =>
      `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:Cours\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/rooms") return new Response(JSON.stringify(["A042.ics", "B040.ics"]), { status: 200 });
      if (url === "/rooms/A042.ics") return new Response(calendar(stamp(at(16)), stamp(at(18))), { status: 200 });
      if (url === "/rooms/B040.ics") return new Response(calendar(stamp(at(13)), stamp(at(15))), { status: 200 });
      return new Response("", { status: 404 });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  const mountView = async () => {
    const schedule = useScheduleStore();
    schedule.loadRoomSchedule = vi.fn();
    const wrapper = mount({ render: () => h(VApp, () => h(FreeRoomsView)) }, { attachTo: document.body });
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find(".room-item").exists()).toBe(true));
    return { wrapper, schedule };
  };

  it("lists the rooms free now, with their availability", async () => {
    const { wrapper } = await mountView();
    expect(wrapper.find("#roomDate").element.value).toBe("2026-09-28");
    expect(wrapper.find("#roomTime").element.value).toBe("14:00");

    const items = wrapper.findAll(".room-item").map((i) => i.text());
    expect(items.some((t) => t.includes("Salle B040"))).toBe(false); // busy until 15h
    expect(items.find((t) => t.includes("Salle A042"))).toContain("Libre jusqu'à 16h00");
    // Known rooms without a calendar are free all day.
    expect(items).toHaveLength(KNOWN_ROOMS.length - 1);
    expect(wrapper.find(".summary").text()).toContain(`${KNOWN_ROOMS.length - 1} salles libres`);
  });

  it("filters by building and opens a room's schedule", async () => {
    const { wrapper, schedule } = await mountView();
    const chipB = wrapper.findAll(".building-row .v-chip").find((c) => c.text().startsWith("Bât. B"));
    await chipB.trigger("click");
    const rooms = wrapper.findAll(".room-item").map((i) => i.text());
    expect(rooms.every((t) => t.includes("Salle B"))).toBe(true);

    await wrapper.find(".room-item").trigger("click");
    expect(schedule.loadRoomSchedule).toHaveBeenCalledWith(expect.stringMatching(/^B/));
  });

  it("re-runs the search for another moment", async () => {
    const { wrapper } = await mountView();
    await wrapper.find("#roomTime").setValue("15:30");
    await wrapper.find("#roomTime").trigger("change");
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.findAll(".room-item").map((i) => i.text()).some((t) => t.includes("Salle B040"))).toBe(true));
  });
});
