import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import * as aggregator from "../ics/aggregator.js";
import { useScheduleStore } from "../stores/schedule.js";
import { useCatalogStore } from "../stores/catalog.js";
import { useOverlaysStore } from "../stores/overlays.js";
import { usePersonalStore } from "../stores/personal.js";
import { useStatusStore } from "../stores/status.js";

describe("Pinia stores", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("loads a teacher schedule only once when the loader switches the mode itself", async () => {
    const spy = vi
      .spyOn(aggregator, "getTeacherIndex")
      .mockResolvedValue(new Map([["DUPONT Jean", [{ summary: "TD", start: new Date(), end: new Date() }]]]));
    const schedule = useScheduleStore();

    await schedule.loadTeacherSchedule("DUPONT Jean");
    await flushPromises();

    // Regression: the selectedMode watcher used to reload the same schedule
    // (a second full index aggregation on every mode switch).
    const scheduleLoads = spy.mock.calls.filter((args) => args.length === 0).length;
    expect(scheduleLoads).toBe(1);
    expect(schedule.selectedMode).toBe("teacher");
  });

  it("still reacts to external mode changes (e.g. selects bound to selectedMode)", async () => {
    const spy = vi.spyOn(aggregator, "getRoomIndex").mockResolvedValue(new Map([["A042", []]]));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    const schedule = useScheduleStore();
    schedule.selectedRoom = "A042";

    schedule.selectedMode = "room";
    await flushPromises();

    expect(spy).toHaveBeenCalled();
  });

  it("catalog parses promo file names into year/track/type/rest", () => {
    const catalog = useCatalogStore();
    catalog.availableFiles = ["3A-IR-TD1-Groupe-B.ics"];
    expect(catalog.findFile("3A-IR-TD1-Groupe-B.ics")).toMatchObject({ year: "3A", track: "IR", type: "TD1", rest: "Groupe-B" });
  });

  it("overlays merge by UID, keep order and respect the RU toggle", () => {
    const overlays = useOverlaysStore();
    const base = [{ uid: "a", start: "2026-09-28T10:00:00Z" }];
    const extra = [
      { uid: "a", start: "2026-09-28T10:00:00Z" },
      { uid: "b", start: "2026-09-28T08:00:00Z" },
    ];
    expect(overlays.mergeWithCercle(base, extra).map((e) => e.uid)).toEqual(["b", "a"]);

    overlays.setShowRuMenu(false);
    expect(overlays.mergeWithRu(base, extra)).toBe(base);
    expect(localStorage.getItem("edtShowRuMenu")).toBe("false");
  });

  it("personal store persists metadata without credentials and forgets everything", () => {
    const personal = usePersonalStore();
    const meta = personal.remember("BEGIN:VCALENDAR\r\nEND:VCALENDAR", { name: "Moi", login: "a", password: "b" });
    expect(meta).not.toHaveProperty("password");
    expect(JSON.parse(localStorage.getItem("edt_personal_meta"))).not.toHaveProperty("login");
    expect(personal.getCachedIcs()).toContain("VCALENDAR");

    personal.forget();
    expect(personal.getCachedIcs()).toBeNull();
    expect(personal.personalScheduleInfo).toBeNull();
  });

  it("status action is cleared when another message replaces it", async () => {
    const status = useStatusStore();
    status.setStatus("Identifiants manquants", "configure-personal");
    expect(status.statusAction).toBe("configure-personal");
    status.statusMessage = "Chargement…";
    await flushPromises();
    expect(status.statusAction).toBeNull();
  });
});
