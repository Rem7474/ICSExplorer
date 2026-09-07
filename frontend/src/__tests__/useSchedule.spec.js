import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSchedule } from "../composables/useSchedule.js";
import * as aggregator from "../ics/aggregator.js";
import * as api from "../ics/api.js";

describe("useSchedule composable", () => {
  beforeEach(() => {
    localStorage.clear();
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

  it("toggles subject visibility / deselection properly", () => {
    const schedule = useSchedule();

    expect(schedule.disabledSubjects.value).toEqual([]);
    schedule.toggleSubjectFilter("IN");
    expect(schedule.disabledSubjects.value).toEqual(["IN"]);
    expect(schedule.selectedSubjectFilter.value).toBe("IN");

    schedule.toggleSubjectFilter("MAC");
    expect(schedule.disabledSubjects.value).toEqual(["IN", "MAC"]);

    schedule.toggleSubjectFilter("IN");
    expect(schedule.disabledSubjects.value).toEqual(["MAC"]);

    schedule.resetSubjectFilters();
    expect(schedule.disabledSubjects.value).toEqual([]);
    expect(schedule.selectedSubjectFilter.value).toBeNull();
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

    // Mock fetchPersonalCalendar to throw
    vi.mock("../ics/api.js", () => ({
      fetchFileList: vi.fn().mockResolvedValue([]),
      fetchIcsText: vi.fn(),
      fetchPersonalCalendar: vi.fn().mockRejectedValue(new Error("Network error")),
      fetchTreeNodes: vi.fn(),
      fetchUniversities: vi.fn().mockResolvedValue([]),
      fileUrl: vi.fn(),
    }));

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
});
