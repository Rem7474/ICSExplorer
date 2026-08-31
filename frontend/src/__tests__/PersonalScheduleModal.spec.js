import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import PersonalScheduleModal from "../components/PersonalScheduleModal.vue";
import { useSchedule } from "../composables/useSchedule.js";

vi.mock("../ics/api.js", () => ({
  fetchUniversities: vi.fn().mockResolvedValue([
    { id: "grenoble-inp-esisar", name: "Grenoble INP - Esisar" },
  ]),
  fetchPersonalCalendar: vi.fn(),
  fetchTreeNodes: vi.fn(),
}));

import { fetchPersonalCalendar, fetchTreeNodes } from "../ics/api.js";

describe("PersonalScheduleModal component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fetchPersonalCalendar.mockReset();
    fetchTreeNodes.mockReset();
  });

  it("renders and loads the university list", async () => {
    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    expect(wrapper.text()).toContain("Mon EDT personnel");
    expect(wrapper.find("option").exists()).toBe(true);
  });

  it("emits close when the close button is clicked", async () => {
    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("button.close-btn").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("submits credentials, loads events into schedule, and does not persist them by default", async () => {
    fetchPersonalCalendar.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(fetchPersonalCalendar).toHaveBeenCalledWith({
      universityId: "grenoble-inp-esisar",
      login: "student1",
      password: "hunter2",
    });
    expect(schedule.selectedMode.value).toBe("personal");
    expect(wrapper.emitted("close")).toBeTruthy();
    expect(localStorage.getItem("edtPersonalCreds")).toBeNull();
  });

  it("persists credentials to localStorage only when 'remember' is checked", async () => {
    fetchPersonalCalendar.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");
    await wrapper.find(".remember-field input").setValue(true);
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    const saved = JSON.parse(localStorage.getItem("edtPersonalCreds"));
    expect(saved).toEqual({
      inputMode: "list",
      universityId: "grenoble-inp-esisar",
      login: "student1",
      password: "hunter2",
      resourceId: "",
    });
  });

  it("submits an adeUrl instead of universityId when in URL mode", async () => {
    fetchPersonalCalendar.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find('input[type="radio"][value="url"]').setValue(true);
    await wrapper.find("#adeUrlInput").setValue("https://edt.grenoble-inp.fr/2026-2027/esisar/etudiant/x");
    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(fetchPersonalCalendar).toHaveBeenCalledWith({
      adeUrl: "https://edt.grenoble-inp.fr/2026-2027/esisar/etudiant/x",
      login: "student1",
      password: "hunter2",
    });
  });

  it("shows an error message when the credentials are rejected", async () => {
    fetchPersonalCalendar.mockRejectedValue(new Error("invalid credentials"));
    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("wrong");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.text()).toContain("invalid credentials");
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("explores the ADE tree, allows filtering, and selects a leaf timetable", async () => {
    fetchTreeNodes.mockResolvedValue([
      { id: "10", name: "Filiere Informatique", isLeaf: false },
      { id: "101", name: "Groupe 1", isLeaf: true },
    ]);
    fetchPersonalCalendar.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");

    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");

    // Click "Explorer l'arbre"
    const exploreBtn = wrapper.findAll("button").find((b) => b.text().includes("Explorer l'arbre"));
    expect(exploreBtn).toBeDefined();
    await exploreBtn.trigger("click");
    await flushPromises();

    expect(fetchTreeNodes).toHaveBeenCalledWith({
      universityId: "grenoble-inp-esisar",
      login: "student1",
      password: "hunter2",
    });

    expect(wrapper.text()).toContain("Sélectionner un emploi du temps");
    expect(wrapper.text()).toContain("Filiere Informatique");
    expect(wrapper.text()).toContain("Groupe 1");

    // Test filter/search
    await wrapper.find(".search-input").setValue("Groupe");
    await flushPromises();
    expect(wrapper.text()).toContain("Groupe 1");

    // Click on leaf node "Groupe 1"
    const leafItem = wrapper.findAll(".node-item").find((n) => n.text().includes("Groupe 1"));
    await leafItem.trigger("click");
    await flushPromises();

    expect(fetchPersonalCalendar).toHaveBeenCalledWith({
      universityId: "grenoble-inp-esisar",
      resourceId: "101",
      login: "student1",
      password: "hunter2",
    });
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
