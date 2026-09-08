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

  it("formats multi-day event schedules clearly without truncating end date", () => {
    // Single day event
    const singleEvent = {
      summary: "IN401",
      start: new Date(2026, 8, 18, 13, 30),
      end: new Date(2026, 8, 18, 15, 15),
    };
    const wrapperSingle = mount(EventModal, { props: { event: singleEvent } });
    expect(wrapperSingle.text()).toContain("18/09/2026 à 13h30 - 15h15");

    // Multi-day event (WEI: Fri 18h to Sun 15h)
    const multiEvent = {
      summary: "WEI",
      start: new Date(2026, 8, 18, 18, 0),
      end: new Date(2026, 8, 20, 15, 0),
    };
    const wrapperMulti = mount(EventModal, { props: { event: multiEvent } });
    expect(wrapperMulti.text()).toContain("Du 18/09/2026 à 18h00 au 20/09/2026 à 15h00");
  });
});
