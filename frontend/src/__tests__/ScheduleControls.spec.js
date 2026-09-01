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
});
