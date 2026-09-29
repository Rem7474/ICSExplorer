import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h } from "vue";
import { VApp } from "vuetify/components";
import PlanningGrid from "../components/planning/PlanningGrid.vue";
import EventSheet from "../components/planning/EventSheet.vue";
import { getWeekStart } from "../utils/dates.js";

const monday = getWeekStart(new Date(2026, 8, 30)); // week of Mon 28 Sept 2026
const at = (dayOffset, h, m = 0) => {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};
const course = (summary, day, from, to, extra = {}) => ({ uid: `${summary}-${day}`, summary, start: at(day, from), end: at(day, to), location: "A042", ...extra });

const mountGrid = (props = {}) =>
  mount(PlanningGrid, { props: { weekStart: monday, events: [], ...props }, attachTo: document.body });

describe("PlanningGrid", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("renders the previous, current and next weeks with spoken course labels", () => {
    const wrapper = mountGrid({ events: [course("IN101", 0, 8, 10), course("MT301", 2, 14, 16)] });
    expect(wrapper.findAll(".day-col")).toHaveLength(15);
    const labels = wrapper.findAll(".event").map((e) => e.attributes("aria-label"));
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("IN101");
    expect(labels[0]).toContain("08h00 - 10h00");
    expect(labels[0]).toContain("salle A042");
  });

  it("emits eventClick for courses and all-day banners", async () => {
    const allDay = { uid: "day", summary: "Journée portes ouvertes", start: at(1, 0), end: at(2, 0) };
    const wrapper = mountGrid({ events: [course("IN101", 0, 8, 10), allDay] });
    await wrapper.find(".event").trigger("click");
    await wrapper.find(".allday").trigger("click");
    expect(wrapper.emitted("eventClick").map(([e]) => e.summary)).toEqual(["IN101", "Journée portes ouvertes"]);
  });

  it("switches between the 1-day and 5-day views and remembers the choice", async () => {
    const wrapper = mountGrid();
    const [dayBtn, weekBtn] = wrapper.findAll(".span-btn");
    expect(weekBtn.attributes("aria-pressed")).toBe("true"); // wide screen default
    await dayBtn.trigger("click");
    expect(dayBtn.attributes("aria-pressed")).toBe("true");
    expect(wrapper.find(".planning-grid").classes()).toContain("mode-day");
    expect(localStorage.getItem("edtMobileViewMode")).toBe("day");
  });

  it("fits the whole day to the available height", async () => {
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this.classList?.contains("grid-scroller") ? 500 : 0;
      },
    });
    try {
      localStorage.setItem("edtMobileViewMode", "day");
      const wrapper = mountGrid({ events: [course("IN101", 0, 8, 10)] });
      await flushPromises();
      const tops = wrapper.findAll(".day-col")[5].findAll(".hour-line").map((l) => parseFloat(l.attributes("style").match(/top: ([\d.]+)px/)[1]));
      // 8h–18h in 500px minus margins: ~48px per hour, 18h line inside the scroller.
      expect(tops[1] - tops[0]).toBeCloseTo((500 - 16 - 2) / 10, 1);
      expect(tops.at(-1)).toBeLessThan(500);
    } finally {
      if (desc) Object.defineProperty(HTMLElement.prototype, "clientHeight", desc);
    }
  });

  it("shows the day only once in the 1-day view (chips, no column date)", () => {
    localStorage.setItem("edtMobileViewMode", "day");
    const wrapper = mountGrid({ events: [course("IN101", 0, 8, 10)] });
    expect(wrapper.find(".day-chips").exists()).toBe(true);
    expect(wrapper.find(".day-date").exists()).toBe(false);
    expect(wrapper.find(".period-btn").text()).toMatch(/–/); // week range, not the day
  });

  it("shows the RU menu once, with its first dish, without an extra tag line", () => {
    localStorage.setItem("edtMobileViewMode", "day");
    const ru = course("🍽️ RU Briff'O", 0, 12, 13, {
      categories: "RU,CROUS",
      location: "RU Briff'O (Valence)",
      description: "🍽️ Saveurs du Jour :\n• Curry de légumes\n• Riz",
    });
    const wrapper = mountGrid({ events: [ru] });
    const block = wrapper.find(".event-ru");
    expect(block.text()).toContain("🍽️ RU Briff'O");
    expect(block.text()).toContain("Curry de légumes");
    expect(block.text().match(/RU/g)).toHaveLength(1);
  });

  it("only offers 1-day and 5-day views", () => {
    const wrapper = mountGrid();
    expect(wrapper.findAll(".span-btn").map((b) => b.text())).toEqual(["1J", "5J"]);
  });

  it("tapping a column header in the week view opens that day", async () => {
    const wrapper = mountGrid();
    await wrapper.findAll("button.day-date")[2].trigger("click");
    await flushPromises();
    expect(wrapper.find(".planning-grid").classes()).toContain("mode-day");
  });

  it("moves to the next week once a swipe settles on it", async () => {
    vi.useFakeTimers();
    localStorage.setItem("edtMobileViewMode", "day");
    const wrapper = mountGrid();
    const scroller = wrapper.find(".grid-scroller").element;
    Object.defineProperty(scroller, "clientWidth", { value: 344, configurable: true }); // 300px per day + 44px rail
    scroller.scrollTo = ({ left }) => (scroller.scrollLeft = left);

    scroller.scrollLeft = 300 * 10; // first day of next week
    scroller.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(200);

    const [[newWeek]] = wrapper.emitted("update:weekStart");
    expect(newWeek.getTime()).toBe(new Date(2026, 9, 5).getTime());
  });

  it("offers to jump to the next course when the week is empty", async () => {
    const later = course("IN101", 14, 8, 10); // two weeks later
    const wrapper = mountGrid({ events: [later] });
    const hint = wrapper.find(".next-course-hint");
    expect(hint.exists()).toBe(true);
    await hint.trigger("click");
    const [[target]] = wrapper.emitted("update:weekStart");
    expect(target.getTime()).toBe(getWeekStart(later.start).getTime());
  });

  it("keyboard: T goes back to today", async () => {
    const past = new Date(getWeekStart(new Date()));
    past.setDate(past.getDate() - 14);
    const wrapper = mountGrid({ weekStart: past });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
    await flushPromises();
    const [[target]] = wrapper.emitted("update:weekStart");
    expect(target.getTime()).toBe(getWeekStart(new Date()).getTime());
  });
});

const mountSheet = (event) =>
  mount({ render: () => h(VApp, () => h(EventSheet, { event, onClose: () => {} })) }, { attachTo: document.body });

describe("EventSheet", () => {
  afterEach(() => (document.body.innerHTML = ""));

  const ev = {
    summary: "IN401 Architecture Système",
    location: "A166, A042",
    description: "Architecture en TD avec M. DUPONT Jean",
    start: new Date(2026, 8, 18, 13, 30),
    end: new Date(2026, 8, 18, 15, 15),
  };

  it("shows the course details and schedule", async () => {
    mountSheet(ev);
    await flushPromises();
    const text = document.body.textContent;
    expect(text).toContain("IN401 Architecture Système");
    expect(text).toContain("18/09/2026 à 13h30 - 15h15");
    expect(text).toContain("A166, A042");
  });

  it("room and teacher shortcuts emit their selection and close", async () => {
    const onSelectRoom = vi.fn();
    const onSelectTeacher = vi.fn();
    const onClose = vi.fn();
    mount({ render: () => h(VApp, () => h(EventSheet, { event: ev, onSelectRoom, onSelectTeacher, onClose })) }, { attachTo: document.body });
    await flushPromises();
    const buttons = () => [...document.body.querySelectorAll("button")];
    buttons().find((b) => b.textContent.includes("Salle A166")).click();
    buttons().find((b) => b.textContent.includes("DUPONT")).click();
    expect(onSelectRoom).toHaveBeenCalledWith("A166");
    expect(onSelectTeacher.mock.calls[0][0]).toContain("DUPONT");
    expect(onClose).toHaveBeenCalled();
  });

  it("formats multi-day events without truncating the end date", async () => {
    mountSheet({ ...ev, start: new Date(2026, 8, 18, 18, 0), end: new Date(2026, 8, 20, 15, 0) });
    await flushPromises();
    expect(document.body.textContent).toContain("Du 18/09/2026 à 18h00 au 20/09/2026 à 15h00");
  });
});

describe("PlanningGrid — back to today", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => (document.body.innerHTML = ""));

  // Same rule as the component: weekends target next Monday.
  const todayTargetWeek = () => {
    const d = new Date();
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return getWeekStart(d);
  };

  it("hides the floating button while today is on screen", async () => {
    const wrapper = mount(PlanningGrid, { props: { weekStart: todayTargetWeek(), events: [] }, attachTo: document.body });
    await flushPromises();
    expect(wrapper.find(".today-fab").exists()).toBe(false);
  });

  it("shows it on another week and jumps back to today's week", async () => {
    const past = todayTargetWeek();
    past.setDate(past.getDate() - 21);
    const wrapper = mount(PlanningGrid, { props: { weekStart: past, events: [] }, attachTo: document.body });
    await flushPromises();
    const fab = wrapper.find(".today-fab");
    expect(fab.exists()).toBe(true);
    expect(fab.text()).toContain("Aujourd'hui");
    await fab.trigger("click");
    const [[target]] = wrapper.emitted("update:weekStart");
    expect(target.getTime()).toBe(todayTargetWeek().getTime());
  });
});
