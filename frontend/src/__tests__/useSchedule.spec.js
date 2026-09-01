import { describe, it, expect } from "vitest";
import { useSchedule } from "../composables/useSchedule.js";

describe("useSchedule composable", () => {
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

  it("toggles subject filter properly", () => {
    const schedule = useSchedule();

    expect(schedule.selectedSubjectFilter.value).toBeNull();
    schedule.toggleSubjectFilter("IN");
    expect(schedule.selectedSubjectFilter.value).toBe("IN");
    schedule.toggleSubjectFilter("IN");
    expect(schedule.selectedSubjectFilter.value).toBeNull();
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
});
