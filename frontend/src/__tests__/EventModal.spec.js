import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import EventModal from "../components/EventModal.vue";

describe("EventModal component", () => {
  it("renders event summary and location", () => {
    const event = {
      summary: "IN401 Architecture Système",
      start: new Date(2026, 8, 1, 8, 30),
      end: new Date(2026, 8, 1, 10, 30),
      location: "A166, A042",
      description: "Prof: M. DUPONT Jean\nGroupe 1",
    };

    const wrapper = mount(EventModal, {
      props: { event },
    });

    expect(wrapper.text()).toContain("IN401 Architecture Système");
    expect(wrapper.text()).toContain("A166, A042");
    expect(wrapper.text()).toContain("M. DUPONT Jean");
  });

  it("extracts rooms and emits selectRoom when clicking rebound button", async () => {
    const event = {
      summary: "IN401 TP",
      start: new Date(2026, 8, 1, 8, 30),
      end: new Date(2026, 8, 1, 10, 30),
      location: "A166",
      description: "",
    };

    const wrapper = mount(EventModal, {
      props: { event },
    });

    const roomBtn = wrapper.find(".rebound-badge");
    expect(roomBtn.exists()).toBe(true);
    expect(roomBtn.text()).toContain("Salle A166");

    await roomBtn.trigger("click");
    expect(wrapper.emitted("selectRoom")).toBeTruthy();
    expect(wrapper.emitted("selectRoom")[0]).toEqual(["A166"]);
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("extracts teachers and emits selectTeacher when clicking rebound button", async () => {
    const event = {
      summary: "SN201 TD",
      start: new Date(2026, 8, 1, 8, 30),
      end: new Date(2026, 8, 1, 10, 30),
      location: "B040",
      description: "Enseignant : MARTIN",
    };

    const wrapper = mount(EventModal, {
      props: { event },
    });

    const teacherBtn = wrapper.findAll(".rebound-badge").find((b) => b.text().includes("MARTIN"));
    expect(teacherBtn).toBeDefined();

    await teacherBtn.trigger("click");
    expect(wrapper.emitted("selectTeacher")).toBeTruthy();
    expect(wrapper.emitted("selectTeacher")[0]).toEqual(["MARTIN"]);
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
