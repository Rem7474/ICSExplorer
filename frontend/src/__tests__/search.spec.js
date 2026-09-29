import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h } from "vue";
import { VApp } from "vuetify/components";
import { router } from "../router/index.js";
import SearchView from "../views/SearchView.vue";
import { useCatalogStore } from "../stores/catalog.js";
import { useScheduleStore } from "../stores/schedule.js";
import { useFavorites } from "../composables/useFavorites.js";
import { searchSchedules, promoLabel, groupBy, initialOf, buildingOf } from "../utils/search.js";

describe("search helpers", () => {
  const lists = { files: ["1A-Prépa-TP1.ics", "3A-IR-TD1.ics"], teachers: ["DUPONT Jean", "Éric MARTIN"], rooms: ["A042", "B040"] };

  it("matches promos, teachers and rooms regardless of accents and case", () => {
    expect(searchSchedules(lists, "prepa").map((r) => r.value)).toEqual(["1A-Prépa-TP1.ics"]);
    expect(searchSchedules(lists, "eric")[0]).toMatchObject({ type: "teacher", value: "Éric MARTIN" });
    expect(searchSchedules(lists, "a04")[0]).toMatchObject({ type: "room", label: "Salle A042", value: "A042" });
  });

  it("needs at least two characters", () => {
    expect(searchSchedules(lists, " a ")).toEqual([]);
  });

  it("builds short labels and groups", () => {
    expect(promoLabel({ fileName: "1A-Test-TP-A.ics", year: "1A", track: "Test", type: "TP", rest: "A" })).toBe("TP A");
    expect(promoLabel({ fileName: "misc.ics", year: "misc", track: "", type: "", rest: "" })).toBe("misc");
    expect(groupBy(["Bob", "Alice", "Bea"], (n) => n[0])).toEqual([
      { key: "B", items: ["Bob", "Bea"] },
      { key: "A", items: ["Alice"] },
    ]);
    expect(initialOf("Éric")).toBe("E");
    expect(buildingOf("a042")).toBe("A");
    expect(buildingOf("123")).toBe("Autres");
  });
});

describe("SearchView", () => {
  let openPersonalSchedule;

  const mountSearch = async ({ files = ["1A-Prépa-TP1.ics", "1A-Prépa-TP2.ics", "3A-IR-TD1.ics"], teachers = ["DUPONT Jean"], rooms = ["A042"] } = {}) => {
    await router.push("/rechercher");
    const catalog = useCatalogStore();
    const schedule = useScheduleStore();
    catalog.availableFiles = files;
    catalog.availableTeachers = teachers;
    catalog.availableRooms = rooms;
    catalog.loadTeacherList = vi.fn();
    catalog.loadRoomList = vi.fn();
    schedule.loadSchedule = vi.fn();
    schedule.loadTeacherSchedule = vi.fn();
    schedule.loadRoomSchedule = vi.fn();
    schedule.setMode = vi.fn();
    openPersonalSchedule = vi.fn();
    const wrapper = mount({ render: () => h(VApp, () => h(SearchView)) }, {
      attachTo: document.body,
      global: { plugins: [router], provide: { openPersonalSchedule } },
    });
    await flushPromises();
    return { wrapper, catalog, schedule, input: wrapper.find("#quickSearchInput") };
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => (document.body.innerHTML = ""));

  it("exposes an accessible combobox", async () => {
    const { input } = await mountSearch();
    expect(input.attributes("role")).toBe("combobox");
    expect(input.attributes("aria-label")).toMatch(/Rechercher un planning/);
    expect(input.attributes("aria-expanded")).toBe("false");
    expect(input.attributes("type")).toBe("search");
  });

  it("navigates results with the keyboard and opens one with Enter", async () => {
    const { schedule, input } = await mountSearch();
    await input.setValue("Prépa");
    expect(input.attributes("aria-expanded")).toBe("true");

    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(input.attributes("aria-activedescendant")).toBe("search-option-1");
    expect(document.querySelector("#search-option-1").getAttribute("aria-selected")).toBe("true");

    await input.trigger("keydown", { key: "Enter" });
    expect(schedule.loadSchedule).toHaveBeenCalledWith("1A-Prépa-TP2.ics");
    expect(input.element.value).toBe("");
  });

  it("opens teachers and rooms from the results", async () => {
    const { schedule, wrapper, input } = await mountSearch();
    await input.setValue("dupont");
    await wrapper.find(".result-item").trigger("click");
    expect(schedule.loadTeacherSchedule).toHaveBeenCalledWith("DUPONT Jean");

    await input.setValue("A04");
    await wrapper.find(".result-item").trigger("click");
    expect(schedule.loadRoomSchedule).toHaveBeenCalledWith("A042");
  });

  it("says when nothing matches and clears with Escape", async () => {
    const { wrapper, input } = await mountSearch();
    await input.setValue("zzz-introuvable");
    expect(wrapper.find(".search-status").text()).toContain("Aucun résultat");
    await input.trigger("keydown", { key: "Escape" });
    expect(input.element.value).toBe("");
    expect(wrapper.find(".browse-tabs").exists()).toBe(true);
  });

  it("builds the teacher/room index only when needed", async () => {
    const { catalog, wrapper, input } = await mountSearch({ teachers: [], rooms: [] });
    expect(catalog.loadTeacherList).not.toHaveBeenCalled();

    await input.setValue("DU");
    expect(catalog.loadTeacherList).toHaveBeenCalledTimes(1);
    expect(catalog.loadRoomList).toHaveBeenCalledTimes(1);

    catalog.isAggregatorLoading = true;
    catalog.indexProgress = { loaded: 12, total: 48 };
    await flushPromises();
    expect(wrapper.find(".search-status").text()).toContain("12/48");
  });

  it("browses promos by year and track", async () => {
    const { schedule, wrapper } = await mountSearch();
    expect(wrapper.find(".v-list-subheader").text()).toBe("Prépa");
    expect(wrapper.findAll(".browse-item").map((i) => i.text())).toEqual(["TP1", "TP2"]);

    // Another year
    const chip3A = wrapper.findAll(".year-row .v-chip").find((c) => c.text() === "3A");
    await chip3A.trigger("click");
    expect(wrapper.findAll(".browse-item").map((i) => i.text())).toEqual(["TD1"]);
    await wrapper.find(".browse-item").trigger("click");
    expect(schedule.loadSchedule).toHaveBeenCalledWith("3A-IR-TD1.ics");
  });

  it("lists teachers and rooms in their tabs", async () => {
    const { schedule, catalog, wrapper } = await mountSearch({ teachers: [], rooms: [] });
    const tabs = wrapper.findAll(".browse-tabs .v-tab");
    await tabs[1].trigger("click");
    expect(catalog.loadTeacherList).toHaveBeenCalled();
    catalog.availableTeachers = ["DUPONT Jean", "MARTIN Paul"];
    await flushPromises();
    expect(wrapper.findAll(".browse-item").map((i) => i.text())).toEqual(["DUPONT Jean", "MARTIN Paul"]);

    await tabs[2].trigger("click");
    catalog.availableRooms = ["A042", "B040"];
    await flushPromises();
    expect(wrapper.findAll(".v-list-subheader").map((i) => i.text())).toEqual(["Bâtiment A", "Bâtiment B"]);
    await wrapper.findAll(".browse-item")[1].trigger("click");
    expect(schedule.loadRoomSchedule).toHaveBeenCalledWith("B040");
  });

  it("opens and removes favorites", async () => {
    useFavorites().favorites.value = [{ key: "room_A042", mode: "room", room: "A042", label: "Salle A042" }];
    const { schedule, wrapper } = await mountSearch();

    await wrapper.find(".fav-chip").trigger("click");
    expect(schedule.loadRoomSchedule).toHaveBeenCalledWith("A042");

    await wrapper.find(".fav-chip .v-chip__close").trigger("click");
    expect(wrapper.find(".fav-chip").exists()).toBe(false);
  });

  it("offers to set up the personal ADE schedule when there is none", async () => {
    const { wrapper } = await mountSearch();
    const item = wrapper.find(".personal-item");
    expect(item.text()).toContain("Ajouter mon planning ADE");
    await item.trigger("click");
    expect(openPersonalSchedule).toHaveBeenCalled();
  });
});
