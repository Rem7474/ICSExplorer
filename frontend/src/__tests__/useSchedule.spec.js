import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSchedule } from "../composables/useSchedule.js";
import * as aggregator from "../ics/aggregator.js";
import * as api from "../ics/api.js";

describe("useSchedule composable", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("initializes with safe default empty state without crashing", () => {
    const schedule = useSchedule();

    expect(schedule.availableFiles.value).toEqual([]);
    expect(schedule.selectedFile.value).toBe("");
    expect(schedule.selectedMode.value).toBe("student");
    expect(schedule.events.value).toEqual([]);
    expect(schedule.weekEvents.value).toEqual([]);
    expect(schedule.displayedWeekEvents.value).toEqual([]);
    expect(schedule.nextCourse.value).toBeNull();
    expect(schedule.isRoomModalOpen.value).toBe(false);
    expect(schedule.activeModalEvent.value).toBeNull();
  });

  it("handles modal open and close methods correctly", () => {
    const schedule = useSchedule();

    // Room modal
    expect(schedule.isRoomModalOpen.value).toBe(false);
    schedule.openRoomModal();
    expect(schedule.isRoomModalOpen.value).toBe(true);
    schedule.closeRoomModal();
    expect(schedule.isRoomModalOpen.value).toBe(false);

    // Event modal
    const mockEvent = { summary: "Test Event", start: new Date(), end: new Date() };
    expect(schedule.activeModalEvent.value).toBeNull();
    schedule.openEventModal(mockEvent);
    expect(schedule.activeModalEvent.value).toEqual(mockEvent);
    schedule.closeEventModal();
    expect(schedule.activeModalEvent.value).toBeNull();
  });

  it("handles week navigation correctly", () => {
    const schedule = useSchedule();
    const initialStart = new Date(schedule.currentWeekStart.value);

    schedule.nextWeek();
    const nextStart = new Date(schedule.currentWeekStart.value);
    expect(nextStart.getTime() - initialStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);

    schedule.prevWeek();
    const backStart = new Date(schedule.currentWeekStart.value);
    expect(backStart.getTime()).toBe(initialStart.getTime());

    schedule.goToCurrentWeek();
    expect(schedule.currentWeekStart.value).toBeInstanceOf(Date);
  });

  it("toggles subject visibility / deselection properly with new array reference and localStorage persistence", () => {
    const schedule = useSchedule();

    expect(schedule.disabledSubjects.value).toEqual([]);
    const ref0 = schedule.disabledSubjects.value;

    schedule.toggleSubjectFilter("IN");
    expect(schedule.disabledSubjects.value).toEqual(["IN"]);
    expect(schedule.disabledSubjects.value).not.toBe(ref0);
    expect(schedule.selectedSubjectFilter.value).toBe("IN");

    // Check localStorage persistence
    const saved1 = JSON.parse(localStorage.getItem("edtDisabledSubjects") || "{}");
    expect(saved1["default"]).toEqual(["IN"]);

    const ref1 = schedule.disabledSubjects.value;
    schedule.toggleSubjectFilter("MAC");
    expect(schedule.disabledSubjects.value).toEqual(["IN", "MAC"]);
    expect(schedule.disabledSubjects.value).not.toBe(ref1);

    const saved2 = JSON.parse(localStorage.getItem("edtDisabledSubjects") || "{}");
    expect(saved2["default"]).toEqual(["IN", "MAC"]);

    schedule.toggleSubjectFilter("IN");
    expect(schedule.disabledSubjects.value).toEqual(["MAC"]);

    schedule.resetSubjectFilters();
    expect(schedule.disabledSubjects.value).toEqual([]);
    expect(schedule.selectedSubjectFilter.value).toBeNull();

    const saved3 = JSON.parse(localStorage.getItem("edtDisabledSubjects") || "{}");
    expect(saved3["default"]).toBeUndefined();
  });

  it("persists disabled subjects per schedule and restores them on load", async () => {
    vi.spyOn(api, "fetchIcsText").mockResolvedValue(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:IN101 Cours\nDTSTART:20260901T080000Z\nDTEND:20260901T100000Z\nUID:1\nEND:VEVENT\nEND:VCALENDAR`);
    vi.spyOn(api, "fetchCercleEvents").mockResolvedValue([]);
    vi.spyOn(aggregator, "getTeacherIndex").mockResolvedValue(new Map([
      ["DUPONT", [{ summary: "MATH101", start: new Date("2026-09-01T08:00:00Z"), end: new Date("2026-09-01T10:00:00Z") }]]
    ]));

    const schedule = useSchedule();

    // 1. Load student schedule
    await schedule.loadSchedule("1A-Prepa-TP1.ics");
    expect(schedule.disabledSubjects.value).toEqual([]);

    // Disable IN for this student schedule
    schedule.toggleSubjectFilter("IN");
    expect(schedule.disabledSubjects.value).toEqual(["IN"]);

    // 2. Switch to teacher Dupont
    await schedule.loadTeacherSchedule("DUPONT");
    // Dupont should have no disabled subjects yet
    expect(schedule.disabledSubjects.value).toEqual([]);

    // Disable MATH for Dupont
    schedule.toggleSubjectFilter("MATH");
    expect(schedule.disabledSubjects.value).toEqual(["MATH"]);

    // 3. Switch back to student schedule -> IN should be restored!
    await schedule.loadSchedule("1A-Prepa-TP1.ics");
    expect(schedule.disabledSubjects.value).toEqual(["IN"]);

    // 4. Switch back to teacher Dupont -> MATH should be restored!
    await schedule.loadTeacherSchedule("DUPONT");
    expect(schedule.disabledSubjects.value).toEqual(["MATH"]);

    // 5. Reset Dupont's filters
    schedule.resetSubjectFilters();
    expect(schedule.disabledSubjects.value).toEqual([]);

    // Student schedule IN remains intact
    await schedule.loadSchedule("1A-Prepa-TP1.ics");
    expect(schedule.disabledSubjects.value).toEqual(["IN"]);
  });

  it("filters out deselected subjects from displayedWeekEvents", () => {
    const schedule = useSchedule();
    const eventTime = new Date(schedule.currentWeekStart.value);
    eventTime.setHours(10, 0, 0, 0);
    const eventEnd = new Date(eventTime.getTime() + 3600000);
    // Two events during current week
    schedule.events.value = [
      { summary: "IN101 Algo", start: eventTime, end: eventEnd },
      { summary: "Management Projet", start: eventTime, end: eventEnd },
    ];

    expect(schedule.displayedWeekEvents.value.length).toBe(2);
    // Deselect IN
    schedule.toggleSubjectFilter("IN");
    expect(schedule.displayedWeekEvents.value.length).toBe(1);
    expect(schedule.displayedWeekEvents.value[0].summary).toBe("Management Projet");

    // Deselect MAC as well
    schedule.toggleSubjectFilter("MAC");
    expect(schedule.displayedWeekEvents.value.length).toBe(0);

    // Reset
    schedule.resetSubjectFilters();
    expect(schedule.displayedWeekEvents.value.length).toBe(2);

    // Cercle event with non-keyword summary (e.g. isCercle: true)
    schedule.events.value = [
      { summary: "Rentrée de l'étudiant", isCercle: true, start: eventTime, end: eventEnd },
      { summary: "IN101 Algo", start: eventTime, end: eventEnd },
    ];
    expect(schedule.displayedWeekEvents.value.length).toBe(2);
    schedule.toggleSubjectFilter("CERCLE");
    expect(schedule.displayedWeekEvents.value.length).toBe(1);
    expect(schedule.displayedWeekEvents.value[0].summary).toBe("IN101 Algo");
  });

  it("loads personal events from raw ICS text, sets meta, and switches to personal mode", () => {
    const schedule = useSchedule();
    const icsText = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "SUMMARY:Cours perso",
      "DTSTART:20260901T080000",
      "DTEND:20260901T100000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    schedule.loadPersonalEvents(icsText, {
      name: "3A - Ingénieur - Apprenti",
      universityId: "grenoble-inp-esisar",
      universityName: "Grenoble INP - Esisar",
    });

    expect(schedule.selectedMode.value).toBe("personal");
    expect(schedule.events.value.length).toBe(1);
    expect(schedule.events.value[0].summary).toBe("Cours perso");
    expect(schedule.personalScheduleInfo.value.name).toBe("3A - Ingénieur - Apprenti");
    expect(localStorage.getItem("edt_cached_personal_ics")).toBe(icsText);
    expect(JSON.parse(localStorage.getItem("edtSelection"))).toEqual({ mode: "personal" });

    const url = new URL(window.location);
    expect(url.searchParams.get("mode")).toBe("personal");
  });

  it("clears personal schedule and switches back to student mode", () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "personal";
    schedule.availableFiles.value = ["1A-Prepa.ics"];
    localStorage.setItem("cachedPersonalIcs", "BEGIN:VCALENDAR...");
    localStorage.setItem("personalAdeCredentials", "{}");

    schedule.clearPersonalSchedule();

    expect(schedule.selectedMode.value).toBe("student");
    expect(localStorage.getItem("cachedPersonalIcs")).toBeNull();
    expect(localStorage.getItem("personalAdeCredentials")).toBeNull();
  });

  it("refreshPersonalSchedule does nothing and sets statusMessage when no credentials are saved", async () => {
    const schedule = useSchedule();
    localStorage.removeItem("edtPersonalCreds");

    await schedule.refreshPersonalSchedule();

    expect(schedule.statusMessage.value).toContain("Aucun identifiant");
    expect(schedule.isLoading.value).toBe(false);
  });

  it("refreshPersonalSchedule sets error statusMessage on network failure", async () => {
    const schedule = useSchedule();

    // Save fake credentials so refresh attempts the fetch
    localStorage.setItem(
      "edtPersonalCreds",
      JSON.stringify({ adeUrl: "https://example.com", login: "u", password: "p", branchPath: [] })
    );

    vi.spyOn(api, "fetchPersonalCalendar").mockRejectedValue(new Error("Network error"));

    await schedule.refreshPersonalSchedule();

    expect(schedule.isLoading.value).toBe(false);
    expect(schedule.statusMessage.value).toContain("Impossible d'actualiser");
  });

  it("loadTeacherList populates availableTeachers from aggregator index", async () => {
    const mockMap = new Map();
    mockMap.set("DUPONT Jean", [{ summary: "Maths", start: new Date(), end: new Date() }]);
    mockMap.set("MARTIN Sophie", [{ summary: "Physique", start: new Date(), end: new Date() }]);
    vi.spyOn(aggregator, "getTeacherIndex").mockResolvedValue(mockMap);

    const schedule = useSchedule();
    await schedule.loadTeacherList();

    expect(schedule.availableTeachers.value).toEqual(["DUPONT Jean", "MARTIN Sophie"]);
  });

  it("loadRoomList populates availableRooms from aggregator index", async () => {
    const mockMap = new Map();
    mockMap.set("B148", [{ summary: "TP", start: new Date(), end: new Date() }]);
    mockMap.set("A042", [{ summary: "CM", start: new Date(), end: new Date() }]);
    vi.spyOn(aggregator, "getRoomIndex").mockResolvedValue(mockMap);

    const schedule = useSchedule();
    await schedule.loadRoomList();

    expect(schedule.availableRooms.value).toEqual(["A042", "B148"]);
  });

  it("loadTeacherSchedule loads teacher events, updates week, localStorage and URL", async () => {
    const mockMap = new Map();
    const mockEvent = { summary: "Maths TD", start: new Date("2026-09-01T08:00:00Z"), end: new Date("2026-09-01T10:00:00Z") };
    mockMap.set("DUPONT Jean", [mockEvent]);
    vi.spyOn(aggregator, "getTeacherIndex").mockResolvedValue(mockMap);

    const schedule = useSchedule();
    await schedule.loadTeacherSchedule("DUPONT Jean");

    expect(schedule.events.value).toEqual([mockEvent]);
    expect(JSON.parse(localStorage.getItem("edtSelection"))).toEqual({ mode: "teacher", teacher: "DUPONT Jean" });
    const url = new URL(window.location);
    expect(url.searchParams.get("teacher")).toBe("DUPONT Jean");
    expect(url.searchParams.get("file")).toBeNull();
  });

  it("loadRoomSchedule loads room events, updates week, localStorage and URL", async () => {
    const mockMap = new Map();
    const mockEvent = { summary: "Automatique TP", start: new Date("2026-09-02T14:00:00Z"), end: new Date("2026-09-02T16:00:00Z") };
    mockMap.set("A042", [mockEvent]);
    vi.spyOn(aggregator, "getRoomIndex").mockResolvedValue(mockMap);

    const schedule = useSchedule();
    await schedule.loadRoomSchedule("A042");

    expect(schedule.events.value).toEqual([mockEvent]);
    expect(JSON.parse(localStorage.getItem("edtSelection"))).toEqual({ mode: "room", room: "A042" });
    const url = new URL(window.location);
    expect(url.searchParams.get("room")).toBe("A042");
    expect(url.searchParams.get("file")).toBeNull();
  });

  it("returnToBaseSchedule restores student base schedule when coming from teacher mode", async () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Prepa-TP1.ics", "3A-IR-IR1.ics"];
    schedule.baseSchedule.value = { mode: "student", file: "1A-Prepa-TP1.ics", name: "1A-Prepa-TP1" };
    schedule.selectedMode.value = "teacher";
    schedule.selectedTeacher.value = "DUPONT Jean";

    const fetchSpy = vi.spyOn(api, "fetchIcsText").mockResolvedValue("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Prepa Event\r\nDTSTART:20260901T080000Z\r\nDTEND:20260901T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR");

    await schedule.returnToBaseSchedule();

    expect(schedule.selectedMode.value).toBe("student");
    expect(schedule.selectedFile.value).toBe("1A-Prepa-TP1.ics");
    expect(fetchSpy).toHaveBeenCalledWith("1A-Prepa-TP1.ics");
    expect(schedule.events.value.length).toBe(1);
    expect(schedule.events.value[0].summary).toBe("Prepa Event");
  });

  it("returnToBaseSchedule restores personal base schedule when configured", async () => {
    const schedule = useSchedule();
    schedule.baseSchedule.value = { mode: "personal", name: "Mon Planning ADE" };
    schedule.selectedMode.value = "room";
    schedule.selectedRoom.value = "A042";

    const icsText = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Cours\r\nDTSTART:20260901T080000Z\r\nDTEND:20260901T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    localStorage.setItem("edt_cached_personal_ics", icsText);
    localStorage.setItem("edt_personal_meta", JSON.stringify({ name: "Mon Planning ADE" }));

    await schedule.returnToBaseSchedule();

    expect(schedule.selectedMode.value).toBe("personal");
    expect(schedule.events.value.length).toBe(1);
    expect(schedule.events.value[0].summary).toBe("Cours");
  });

  it("setMode changes mode and reloads schedule", async () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Prepa-TP1.ics"];
    schedule.selectedFile.value = "1A-Prepa-TP1.ics";
    schedule.selectedMode.value = "teacher";

    const fetchSpy = vi.spyOn(api, "fetchIcsText").mockResolvedValue("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Prepa Event\r\nDTSTART:20260901T080000Z\r\nDTEND:20260901T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR");

    await schedule.setMode("student");

    expect(schedule.selectedMode.value).toBe("student");
    expect(fetchSpy).toHaveBeenCalledWith("1A-Prepa-TP1.ics");
    expect(schedule.events.value.length).toBe(1);
    expect(schedule.events.value[0].summary).toBe("Prepa Event");
  });

  it("loadTeacherSchedule aggregates and deduplicates identical courses from multiple promos", async () => {
    aggregator.clearAggregatedCache();
    vi.spyOn(api, "fetchFileList").mockResolvedValue(["1A-Prepa-G1.ics", "1A-Prepa-G2.ics"]);

    const courseICS = (group) => `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:cm-elec-1
SUMMARY:Électronique CM
LOCATION:A166
DESCRIPTION:Électronique avec BARBOT Nicolas\\nPromo ${group}
DTSTART:20260908T080000Z
DTEND:20260908T100000Z
END:VEVENT
END:VCALENDAR`;

    vi.spyOn(api, "fetchIcsText").mockImplementation((file) => {
      if (file === "1A-Prepa-G1.ics") return Promise.resolve(courseICS("G1"));
      if (file === "1A-Prepa-G2.ics") return Promise.resolve(courseICS("G2"));
      return Promise.resolve("");
    });

    const schedule = useSchedule();
    await schedule.loadTeacherSchedule("BARBOT Nicolas");

    expect(schedule.selectedMode.value).toBe("teacher");
    // Should be deduplicated to 1 event instead of 2
    expect(schedule.events.value).toHaveLength(1);
    expect(schedule.events.value[0].summary).toBe("Électronique CM");
    expect(schedule.events.value[0].sourceFiles).toContain("1A-Prepa-G1.ics");
    expect(schedule.events.value[0].sourceFiles).toContain("1A-Prepa-G2.ics");
  });

  it("loadSchedule synchronizes selectedMode, selectedFile and autoSelectFromFile", async () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Prepa-TP1.ics", "3A-IR-IR1.ics"];
    schedule.selectedMode.value = "teacher";
    schedule.selectedTeacher.value = "DUPONT Jean";

    vi.spyOn(api, "fetchIcsText").mockResolvedValue("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Prepa Course\r\nDTSTART:20260901T080000Z\r\nDTEND:20260901T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR");

    await schedule.loadSchedule("1A-Prepa-TP1.ics");

    expect(schedule.selectedMode.value).toBe("student");
    expect(schedule.selectedFile.value).toBe("1A-Prepa-TP1.ics");
    expect(schedule.selectedYear.value).toBe("1A");
    expect(schedule.selectedTrack.value).toBe("Prepa");
  });

  it("loadSchedule loads academic file and merges Cercle events on client side", async () => {
    const schedule = useSchedule();
    vi.spyOn(api, "fetchIcsText").mockResolvedValue(
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:ade-course-1\r\nSUMMARY:Maths 3A\r\nDTSTART:20260918T080000Z\r\nDTEND:20260918T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR"
    );
    vi.spyOn(api, "fetchCercleEvents").mockResolvedValue([
      {
        uid: "cercle-1",
        summary: "Soirée Cercle",
        start: new Date("2026-09-18T18:00:00Z"),
        end: new Date("2026-09-18T23:00:00Z"),
        isCercle: true,
        categories: "CERCLE",
        source: "Cercle Esisar",
      },
    ]);

    await schedule.loadSchedule("3A-Ingé-App-S9-SEC.ics");

    expect(schedule.events.value.length).toBe(2);
    const summaries = schedule.events.value.map((e) => e.summary);
    expect(summaries).toContain("Maths 3A");
    expect(summaries).toContain("Soirée Cercle");

    const cercleEvent = schedule.events.value.find((e) => e.summary === "Soirée Cercle");
    expect(cercleEvent.isCercle).toBe(true);
  });

  it("checkHealth updates serverHealth and starts/stops polling cleanly", async () => {
    const schedule = useSchedule();
    const mockHealth = {
      status: "healthy",
      fresh: true,
      last_sync: "2026-09-16T12:00:00Z",
      last_sync_age: "5m",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    });

    const result = await schedule.checkHealth();
    expect(result).toEqual(mockHealth);
    expect(schedule.serverHealth.value).toEqual(mockHealth);

    // Test start and stop polling
    vi.useFakeTimers();
    schedule.startHealthPolling(1000);
    vi.advanceTimersByTime(2000);
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 initial + 2 interval ticks

    schedule.stopHealthPolling();
    vi.advanceTimersByTime(2000);
    expect(fetchSpy).toHaveBeenCalledTimes(3); // no more calls after stop
    vi.useRealTimers();
  });

  it("checkHealth triggers reloadCurrentScheduleSilently when last_sync updates", async () => {
    const schedule = useSchedule();
    schedule.serverHealth.value = {
      status: "healthy",
      last_sync: "2026-09-16T11:00:00Z",
    };
    schedule.selectedMode.value = "student";
    schedule.selectedFile.value = "1A-Prepa-TP1.ics";

    vi.spyOn(api, "fetchFileList").mockResolvedValue(["1A-Prepa-TP1.ics"]);
    vi.spyOn(api, "fetchIcsText").mockResolvedValue(
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:new-ev\r\nSUMMARY:Updated Course\r\nDTSTART:20260916T080000Z\r\nDTEND:20260916T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR"
    );
    vi.spyOn(api, "fetchCercleEvents").mockResolvedValue([]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "healthy",
        last_sync: "2026-09-16T12:00:00Z",
      }),
    });

    await schedule.checkHealth();

    expect(schedule.serverHealth.value.last_sync).toBe("2026-09-16T12:00:00Z");
    expect(schedule.events.value.length).toBe(1);
    expect(schedule.events.value[0].summary).toBe("Updated Course");
  });

  it("updates nextCourse dynamically as currentTime ticks past an event end time", () => {
    vi.useFakeTimers();
    const schedule = useSchedule();

    const baseTime = new Date("2026-09-18T08:00:00Z").getTime();
    vi.setSystemTime(baseTime);
    schedule.currentTime.value = baseTime;

    const course1 = {
      summary: "First Course",
      start: new Date("2026-09-18T08:00:00Z"),
      end: new Date("2026-09-18T10:00:00Z"),
    };
    const course2 = {
      summary: "Second Course",
      start: new Date("2026-09-18T10:15:00Z"),
      end: new Date("2026-09-18T12:00:00Z"),
    };

    schedule.events.value = [course1, course2];
    expect(schedule.nextCourse.value?.summary).toBe("First Course");

    // Advance time to 10:01:00 (past course 1)
    const afterTime = new Date("2026-09-18T10:01:00Z").getTime();
    vi.setSystemTime(afterTime);
    schedule.currentTime.value = afterTime;

    expect(schedule.nextCourse.value?.summary).toBe("Second Course");
    vi.useRealTimers();
  });

  it("handles online and offline network events by refreshing and displaying toasts", async () => {
    const schedule = useSchedule();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "healthy", last_sync: "2026-09-18T10:00:00Z" }),
    });

    schedule.startHealthPolling();

    // Trigger online event
    window.dispatchEvent(new Event("online"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalled();

    schedule.stopHealthPolling();
  });

  it("reloadCurrentScheduleSilently updates events when promo ICS content changes", async () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "student";
    schedule.selectedFile.value = "2A-SEM.ics";

    const initialIcs = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Math\r\nDTSTART:20260918T080000Z\r\nDTEND:20260918T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const updatedIcs = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Physics (Room Change)\r\nDTSTART:20260918T080000Z\r\nDTEND:20260918T100000Z\r\nLOCATION:Amphi A\r\nEND:VEVENT\r\nEND:VCALENDAR";

    vi.spyOn(api, "fetchFileList").mockResolvedValue(["2A-SEM.ics"]);
    vi.spyOn(api, "fetchCercleEvents").mockResolvedValue([]);
    vi.spyOn(api, "fetchIcsText").mockResolvedValue(initialIcs);

    await schedule.loadSchedule("2A-SEM.ics");
    expect(schedule.events.value[0].summary).toBe("Math");

    // Next reload returns updated ICS
    vi.spyOn(api, "fetchIcsText").mockResolvedValue(updatedIcs);
    const changed = await schedule.reloadCurrentScheduleSilently();

    expect(changed).toBe(true);
    expect(schedule.events.value[0].summary).toBe("Physics (Room Change)");
    expect(schedule.events.value[0].location).toBe("Amphi A");
  });
});

