import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppHeader from "../components/AppHeader.vue";

const NOW = new Date("2026-09-28T12:00:00Z").getTime();

describe("AppHeader component", () => {
  it("renders header brand and default online badge", () => {
    const wrapper = mount(AppHeader);
    expect(wrapper.text()).toContain("ICSExplorer");
    expect(wrapper.text()).toContain("En ligne");
    expect(wrapper.find(".theme-toggle-btn").exists()).toBe(true);
  });

  it("shows how fresh the data is when the server is healthy", () => {
    const wrapper = mount(AppHeader, {
      props: {
        health: { status: "healthy", last_sync: new Date(NOW - 12 * 60000).toISOString() },
        now: NOW,
      },
    });

    expect(wrapper.text()).toContain("À jour · il y a 12 min");
    expect(wrapper.find(".status-online").exists()).toBe(true);
  });

  it("flags stale data with its age instead of sync jargon", () => {
    const wrapper = mount(AppHeader, {
      props: {
        health: { status: "unhealthy", last_sync: new Date(NOW - 3 * 86400000).toISOString() },
        now: NOW,
      },
    });

    expect(wrapper.text()).toContain("Données anciennes · il y a 3 j");
    expect(wrapper.find(".status-warning").exists()).toBe(true);
  });

  it("explains a missing first sync", () => {
    const wrapper = mount(AppHeader, {
      props: { health: { status: "unhealthy", errors: ["no ICS calendar files found"] } },
    });

    expect(wrapper.text()).toContain("Mise à jour en attente");
    expect(wrapper.find(".status-warning").exists()).toBe(true);
  });

  it("shows the offline state first", () => {
    const wrapper = mount(AppHeader, {
      props: { health: { status: "healthy", last_sync: new Date(NOW).toISOString() }, isOnline: false, now: NOW },
    });

    expect(wrapper.text()).toContain("Hors ligne");
    expect(wrapper.find(".status-offline").exists()).toBe(true);
  });

  it("toggles theme on theme button click", async () => {
    const wrapper = mount(AppHeader);
    const themeBtn = wrapper.find(".theme-toggle-btn");
    expect(themeBtn.exists()).toBe(true);
    await themeBtn.trigger("click");
    expect(wrapper.exists()).toBe(true);
  });
});
