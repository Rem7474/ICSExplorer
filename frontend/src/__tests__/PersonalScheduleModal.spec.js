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

  it("submits credentials, explores tree, and selects a timetable without persisting by default", async () => {
    fetchTreeNodes.mockResolvedValue([
      { id: "101", name: "Groupe 1", isLeaf: true },
    ]);
    fetchPersonalCalendar.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");

    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(fetchTreeNodes).toHaveBeenCalledWith({
      universityId: "grenoble-inp-esisar",
      login: "student1",
      password: "hunter2",
    });

    const leafItem = wrapper.findAll(".node-item").find((n) => n.text().includes("Groupe 1"));
    await leafItem.trigger("click");
    await flushPromises();

    expect(fetchPersonalCalendar).toHaveBeenCalledWith({
      universityId: "grenoble-inp-esisar",
      resourceId: "101",
      login: "student1",
      password: "hunter2",
    });
    expect(schedule.selectedMode.value).toBe("personal");
    expect(wrapper.emitted("close")).toBeTruthy();
    expect(localStorage.getItem("edtPersonalCreds")).toBeNull();
  });

  it("persists credentials to localStorage only when 'remember' is checked", async () => {
    fetchTreeNodes.mockResolvedValue([
      { id: "101", name: "3A - Ingénieur", isLeaf: true },
    ]);
    fetchPersonalCalendar.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");

    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");
    await wrapper.find(".remember-field input").setValue(true);
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    const leafItem = wrapper.findAll(".node-item").find((n) => n.text().includes("3A - Ingénieur"));
    await leafItem.trigger("click");
    await flushPromises();

    const saved = JSON.parse(localStorage.getItem("edtPersonalCreds"));
    expect(saved).toEqual({
      inputMode: "list",
      universityId: "grenoble-inp-esisar",
      universityName: "Grenoble INP - Esisar",
      login: "student1",
      password: "hunter2",
      resourceId: "101",
      resourceName: "3A - Ingénieur",
      branchPath: [],
    });
  });

  it("submits an adeUrl instead of universityId when in URL mode", async () => {
    fetchTreeNodes.mockResolvedValue([
      { id: "201", name: "Mon Planning UGA", isLeaf: true },
    ]);
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

    expect(fetchTreeNodes).toHaveBeenCalledWith({
      adeUrl: "https://edt.grenoble-inp.fr/2026-2027/esisar/etudiant/x",
      login: "student1",
      password: "hunter2",
    });
  });

  it("shows an error message when exploring tree fails", async () => {
    fetchTreeNodes.mockRejectedValue(new Error("invalid credentials"));
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

    // Submit form to explore
    await wrapper.find("form").trigger("submit.prevent");
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

  it("allows selecting a whole branch directly", async () => {
    fetchTreeNodes.mockResolvedValue([
      { id: "10", name: "Filiere Informatique", isLeaf: false },
    ]);
    fetchPersonalCalendar.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");

    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    // Click "Choisir" on the branch
    const branchSelectBtn = wrapper.find(".node-select-btn");
    expect(branchSelectBtn.exists()).toBe(true);
    await branchSelectBtn.trigger("click");
    await flushPromises();

    expect(fetchPersonalCalendar).toHaveBeenCalledWith({
      universityId: "grenoble-inp-esisar",
      resourceId: "10",
      branchPath: ["10"],
      login: "student1",
      password: "hunter2",
    });
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("renders title attributes on tree nodes and breadcrumbs for hover tooltip clarity", async () => {
    fetchTreeNodes.mockResolvedValue([
      { id: "10", name: "M1 MANAGEMENT DES SYSTÈMES D'INFORMATION - FI", isLeaf: false },
      { id: "101", name: "M1 MSI Groupe 1 Gestion de Projets Agiles", isLeaf: true },
    ]);

    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    await wrapper.find("#loginInput").setValue("student1");
    await wrapper.find("#passwordInput").setValue("hunter2");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    const branchItem = wrapper.findAll(".node-item").find((n) => n.text().includes("M1 MANAGEMENT"));
    expect(branchItem.attributes("title")).toBe("M1 MANAGEMENT DES SYSTÈMES D'INFORMATION - FI");

    const leafItem = wrapper.findAll(".node-item").find((n) => n.text().includes("M1 MSI Groupe 1"));
    expect(leafItem.attributes("title")).toBe("M1 MSI Groupe 1 Gestion de Projets Agiles");

    const branchBtn = wrapper.find(".node-select-btn");
    expect(branchBtn.attributes("title")).toContain("M1 MANAGEMENT DES SYSTÈMES D'INFORMATION - FI");
  });

  it("automatically opens tree exploration when mounting with existing configured URL / credentials", async () => {
    localStorage.setItem(
      "edtPersonalCreds",
      JSON.stringify({
        inputMode: "url",
        adeUrl: "https://ade-uga.fr/direct/index.jsp?data=testtoken",
      })
    );

    fetchTreeNodes.mockResolvedValue([
      { id: "1674", name: "CAMPUS Grenoble", isLeaf: false },
    ]);

    const schedule = useSchedule();
    const wrapper = mount(PersonalScheduleModal, { props: { schedule } });
    await flushPromises();

    expect(fetchTreeNodes).toHaveBeenCalledWith({
      adeUrl: "https://ade-uga.fr/direct/index.jsp?data=testtoken",
      login: "",
      password: "",
      branchId: undefined,
      branchPath: undefined,
    });
    expect(wrapper.find(".tree-browser").exists()).toBe(true);
    expect(wrapper.text()).toContain("CAMPUS Grenoble");
  });
});
