import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { reactive, h } from "vue";
import { VApp } from "vuetify/components";
import { router } from "../router/index.js";
import { useSchedule } from "../composables/useSchedule.js";
import { freshnessBadge } from "../utils/freshness.js";
import AppTopBar from "../components/shell/AppTopBar.vue";
import AppNav from "../components/shell/AppNav.vue";

const NOW = new Date("2026-09-28T12:00:00Z").getTime();

describe("freshnessBadge", () => {
  it("shows how fresh the data is when the server is healthy", () => {
    const b = freshnessBadge({ status: "healthy", last_sync: new Date(NOW - 12 * 60000).toISOString() }, true, NOW);
    expect(b).toMatchObject({ text: "À jour · il y a 12 min", level: "online" });
  });

  it("flags stale data with its age instead of sync jargon", () => {
    const b = freshnessBadge({ status: "unhealthy", last_sync: new Date(NOW - 3 * 86400000).toISOString() }, true, NOW);
    expect(b).toMatchObject({ text: "Données anciennes · il y a 3 j", level: "warning" });
  });

  it("explains a missing first sync and shows offline first", () => {
    expect(freshnessBadge({ status: "unhealthy" }, true, NOW).text).toBe("Mise à jour en attente");
    expect(freshnessBadge({ status: "healthy", last_sync: new Date(NOW).toISOString() }, false, NOW)).toMatchObject({ text: "Hors ligne", level: "offline" });
    expect(freshnessBadge(null, true, NOW).text).toBe("En ligne");
  });
});

// Shell components need a Vuetify layout (v-app), the router and the
// provided `schedule` facade.
const mountInShell = async (component, path = "/") => {
  await router.push(path);
  const schedule = reactive(useSchedule());
  const wrapper = mount({ render: () => h(VApp, () => h(component)) }, {
    global: { plugins: [router], provide: { schedule, openPersonalSchedule: () => {} } },
  });
  await flushPromises();
  return { wrapper, schedule };
};

describe("app shell", () => {
  beforeEach(() => localStorage.clear());

  it("top bar shows the displayed schedule on Planning, the screen title elsewhere", async () => {
    const { wrapper, schedule } = await mountInShell(AppTopBar, "/");
    schedule.selectedFile = "3A-IR-TD1.ics";
    await flushPromises();
    expect(wrapper.find(".top-bar-title").text()).toBe("3A-IR-TD1");
    expect(wrapper.find('[role="status"]').exists()).toBe(true);

    await router.push("/plus");
    await flushPromises();
    expect(wrapper.find(".top-bar-title").text()).toBe("Plus");
  });

  it("offers a back arrow only when browsing a teacher or room schedule", async () => {
    const { wrapper, schedule } = await mountInShell(AppTopBar, "/");
    schedule.selectedFile = "3A-IR-TD1.ics";
    await flushPromises();
    expect(wrapper.find('[aria-label="Revenir à mon planning"]').exists()).toBe(false);

    schedule.selectedRoom = "A042";
    // Direct assignment would trigger a load; set the store state as a loader would.
    schedule.selectedMode = "room";
    await flushPromises();
    expect(wrapper.find('[aria-label="Revenir à mon planning"]').exists()).toBe(true);
  });

  it("navigation marks the current tab and keeps the schedule in the Planning link", async () => {
    const { wrapper, schedule } = await mountInShell(AppNav, "/rechercher");
    schedule.selectedFile = "1A-Test.ics";
    await flushPromises();

    const items = wrapper.findAll(".nav-item");
    expect(items.map((i) => i.text())).toEqual(["Planning", "Rechercher", "Salles libres", "Plus"]);
    expect(items[1].attributes("aria-current")).toBe("page");

    await items[0].trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/");
    expect(router.currentRoute.value.query.file).toBe("1A-Test.ics");
  });
});
