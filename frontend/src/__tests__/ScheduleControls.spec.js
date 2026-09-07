import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ScheduleControls from "../components/ScheduleControls.vue";
import { useSchedule } from "../composables/useSchedule.js";

describe("ScheduleControls component", () => {
  it("renders safely without errors when schedule has empty initial state", () => {
    const schedule = useSchedule();

    // Verifies no TypeError: selectedFile.replace is not a function
    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find("select#modeSelect").exists()).toBe(true);
  });

  it("handles valid selectedFile string without throwing errors", async () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Prépa-TP1.ics", "3A-IR-IR1.ics"];
    schedule.selectedFile.value = "1A-Prépa-TP1.ics";

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    expect(wrapper.exists()).toBe(true);
    const downloadLink = wrapper.find("a[download]");
    expect(downloadLink.exists()).toBe(true);
  });

  it("emits openEmptyRooms event when button is clicked", async () => {
    const schedule = useSchedule();
    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const emptyRoomsBtn = wrapper.findAll("button").find((b) => b.text().includes("Salles vides"));
    expect(emptyRoomsBtn).toBeDefined();

    await emptyRoomsBtn.trigger("click");
    expect(wrapper.emitted("openEmptyRooms")).toBeTruthy();
    expect(wrapper.emitted("openEmptyRooms").length).toBe(1);
  });

  it("filters search results when typing in quick search input", async () => {
    const schedule = useSchedule();
    schedule.availableFiles.value = ["1A-Prépa-TP1.ics", "3A-IR-IR1.ics", "5A-EIS.ics"];

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const searchInput = wrapper.find(".search-box input");
    await searchInput.trigger("focus");
    await searchInput.setValue("Prépa");

    const searchDropdown = wrapper.find(".search-dropdown");
    expect(searchDropdown.exists()).toBe(true);
    expect(searchDropdown.text()).toContain("1A-Prépa-TP1");
  });

  it("displays unconfigured personal card and emits openPersonalSchedule when unconfigured", async () => {
    localStorage.clear();
    const schedule = useSchedule();
    schedule.selectedMode.value = "personal";
    schedule.personalScheduleInfo.value = null;

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    expect(wrapper.find(".personal-unconfigured-card").exists()).toBe(true);
    expect(wrapper.text()).toContain("Mon Planning Personnel ADE");

    const configBtn = wrapper.find(".btn-configure");
    expect(configBtn.exists()).toBe(true);
    await configBtn.trigger("click");
    expect(wrapper.emitted("openPersonalSchedule")).toBeTruthy();
  });

  it("displays configured personal card when credentials exist", async () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "personal";
    schedule.personalScheduleInfo.value = {
      name: "M1 MSI ADE UGA",
      universityName: "Université Grenoble Alpes",
    };
    localStorage.setItem("edtPersonalCreds", JSON.stringify({ resourceId: "123" }));

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    expect(wrapper.find(".personal-status-card").exists()).toBe(true);
    expect(wrapper.text()).toContain("Planning Actif");
    expect(wrapper.text()).toContain("M1 MSI ADE UGA");
  });

  it("renders teacher options in teacher select and allows choosing a teacher", async () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "teacher";
    schedule.availableTeachers.value = ["DUPONT Jean", "MARTIN Sophie"];

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const teacherSelect = wrapper.find("select#teacherSelect");
    expect(teacherSelect.exists()).toBe(true);
    const options = teacherSelect.findAll("option");
    expect(options.length).toBe(3); // placeholder + 2 teachers
    expect(options[1].text()).toBe("DUPONT Jean");
    expect(options[2].text()).toBe("MARTIN Sophie");
  });

  it("renders room options in room select and allows choosing a room", async () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "room";
    schedule.availableRooms.value = ["A042", "B148", "D001"];

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const roomSelect = wrapper.find("select#roomSelect");
    expect(roomSelect.exists()).toBe(true);
    const options = roomSelect.findAll("option");
    expect(options.length).toBe(4); // placeholder + 3 rooms
    expect(options[1].text()).toBe("A042");
    expect(options[2].text()).toBe("B148");
    expect(options[3].text()).toBe("D001");
  });

  it("searches teachers and rooms in quick search dropdown", async () => {
    const schedule = useSchedule();
    schedule.availableTeachers.value = ["DUPONT Jean"];
    schedule.availableRooms.value = ["A042"];

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const searchInput = wrapper.find(".search-box input");
    await searchInput.trigger("focus");
    await searchInput.setValue("DUPONT");

    const searchDropdown = wrapper.find(".search-dropdown");
    expect(searchDropdown.exists()).toBe(true);
    expect(searchDropdown.text()).toContain("Prof. DUPONT Jean");
    expect(searchDropdown.text()).toContain("Prof");

    await searchInput.setValue("A042");
    expect(searchDropdown.text()).toContain("Salle A042");
    expect(searchDropdown.text()).toContain("Salle");
  });

  it("shows return button in teacher mode and calls returnToBaseSchedule when clicked", async () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "teacher";
    schedule.baseSchedule.value = { mode: "student", file: "1A-Prepa-TP1.ics", name: "1A-Prepa-TP1" };
    schedule.returnToBaseSchedule = vi.fn();

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const returnBtn = wrapper.find(".btn-return-link");
    expect(returnBtn.exists()).toBe(true);
    expect(returnBtn.text()).toContain("Revenir à mon planning (1A-Prepa-TP1)");

    await returnBtn.trigger("click");
    expect(schedule.returnToBaseSchedule).toHaveBeenCalled();
  });

  it("shows return button in toolbar during room mode and calls returnToBaseSchedule", async () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "room";
    schedule.returnToBaseSchedule = vi.fn();

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const toolbarReturnBtn = wrapper.find(".btn-return-base");
    expect(toolbarReturnBtn.exists()).toBe(true);
    expect(toolbarReturnBtn.text()).toContain("Revenir à mon planning");

    await toolbarReturnBtn.trigger("click");
    expect(schedule.returnToBaseSchedule).toHaveBeenCalled();
  });

  it("calls setMode('student') when clicking the Élèves tab", async () => {
    const schedule = useSchedule();
    schedule.selectedMode.value = "teacher";
    schedule.setMode = vi.fn();

    const wrapper = mount(ScheduleControls, {
      props: { schedule },
    });

    const studentTab = wrapper.findAll(".mode-tab-btn")[0];
    await studentTab.trigger("click");

    expect(schedule.setMode).toHaveBeenCalledWith("student");
  });
});

