import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppHeader from "../components/AppHeader.vue";

describe("AppHeader component", () => {
  it("renders header brand and default online badge", () => {
    const wrapper = mount(AppHeader);
    expect(wrapper.text()).toContain("EDT Esisar");
    expect(wrapper.text()).toContain("En ligne");
    expect(wrapper.find(".theme-toggle-btn").exists()).toBe(true);
  });

  it("renders healthy sync badge when health prop is healthy", () => {
    const wrapper = mount(AppHeader, {
      props: {
        health: {
          status: "healthy",
          last_sync_age: "il y a 5 min",
        },
      },
    });

    expect(wrapper.text()).toContain("Synchronisé");
    expect(wrapper.find(".status-online").exists()).toBe(true);
  });

  it("renders warning sync badge when health prop is unhealthy", () => {
    const wrapper = mount(AppHeader, {
      props: {
        health: {
          status: "degraded",
          errors: ["Erreur de synchro"],
        },
      },
    });

    expect(wrapper.text()).toContain("Synchro requise");
    expect(wrapper.find(".status-warning").exists()).toBe(true);
  });

  it("toggles theme on theme button click", async () => {
    const wrapper = mount(AppHeader);
    const themeBtn = wrapper.find(".theme-toggle-btn");
    expect(themeBtn.exists()).toBe(true);
    await themeBtn.trigger("click");
    expect(wrapper.exists()).toBe(true);
  });
});
