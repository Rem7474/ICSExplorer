import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import FavoritesBar from "../components/FavoritesBar.vue";
import { useFavorites } from "../composables/useFavorites.js";

describe("FavoritesBar component", () => {
  beforeEach(() => {
    localStorage.clear();
    const { favorites } = useFavorites();
    favorites.value = [];
  });

  it("does not render when favorites is empty", () => {
    const wrapper = mount(FavoritesBar, {
      props: { currentKey: "" },
    });
    expect(wrapper.find(".favorites-bar").exists()).toBe(false);
  });

  it("renders favorite pills and highlights active pill matching currentKey", async () => {
    const { favorites } = useFavorites();
    favorites.value = [
      { key: "file_1A-Prepa.ics", mode: "student", file: "1A-Prepa.ics", label: "1A-Prepa" },
      { key: "teacher_DUPONT", mode: "teacher", teacher: "DUPONT", label: "Prof. DUPONT" },
    ];

    const wrapper = mount(FavoritesBar, {
      props: { currentKey: "teacher_DUPONT" },
    });

    const pills = wrapper.findAll(".fav-pill");
    expect(pills.length).toBe(2);

    // First pill should NOT be active
    expect(pills[0].classes()).not.toContain("active");
    expect(pills[0].text()).toContain("1A-Prepa");

    // Second pill SHOULD be active
    expect(pills[1].classes()).toContain("active");
    expect(pills[1].text()).toContain("Prof. DUPONT");
  });

  it("emits select event when a favorite pill is clicked", async () => {
    const { favorites } = useFavorites();
    const favItem = { key: "file_1A-Prepa.ics", mode: "student", file: "1A-Prepa.ics", label: "1A-Prepa" };
    favorites.value = [favItem];

    const wrapper = mount(FavoritesBar, {
      props: { currentKey: "" },
    });

    const pill = wrapper.find(".fav-pill");
    await pill.trigger("click");

    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")[0]).toEqual([favItem]);
  });
});
