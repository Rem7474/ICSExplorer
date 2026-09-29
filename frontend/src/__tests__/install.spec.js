import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h } from "vue";
import { VApp } from "vuetify/components";
import { useInstallPrompt } from "../composables/useInstallPrompt.js";
import InstallSheet from "../components/InstallSheet.vue";
import { useScheduleStore } from "../stores/schedule.js";
import { useServerStore } from "../stores/server.js";
import { useToast } from "../composables/useToast.js";

const firePrompt = (outcome = "accepted") => {
  const e = new Event("beforeinstallprompt", { cancelable: true });
  e.prompt = vi.fn(() => Promise.resolve());
  e.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(e);
  return e;
};

describe("install prompt", () => {
  beforeEach(() => {
    localStorage.clear();
    window.dispatchEvent(new Event("appinstalled")); // reset shared state
  });
  afterEach(() => (document.body.innerHTML = ""));

  it("keeps the browser's prompt for our own install button", () => {
    const e = firePrompt();
    const install = useInstallPrompt();
    expect(e.defaultPrevented).toBe(true);
    expect(install.canPrompt.value).toBe(true);
  });

  it("suggests the installation to returning users only, then snoozes it", () => {
    firePrompt();
    const install = useInstallPrompt();
    install.recordVisit();
    expect(install.shouldSuggest()).toBe(false); // first visit
    install.recordVisit();
    expect(install.shouldSuggest()).toBe(true);
    install.dismiss();
    expect(install.shouldSuggest()).toBe(false);
  });

  it("the sheet's Installer button shows the browser dialog", async () => {
    const e = firePrompt("accepted");
    const install = useInstallPrompt();
    mount({ render: () => h(VApp, () => h(InstallSheet)) }, { attachTo: document.body });
    install.openSheet();
    await flushPromises();
    const button = [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes("Installer"));
    button.click();
    await flushPromises();
    expect(e.prompt).toHaveBeenCalled();
    expect(install.sheetOpen.value).toBe(false);
  });

  it("is not offered once installed", () => {
    firePrompt();
    window.dispatchEvent(new Event("appinstalled"));
    expect(useInstallPrompt().available.value).toBe(false);
  });
});

describe("pull-to-refresh action", () => {
  beforeEach(() => useToast().toasts.value.splice(0));

  it("says when the schedule is already up to date", async () => {
    const schedule = useScheduleStore();
    const server = useServerStore();
    server.checkHealth = vi.fn(() => Promise.resolve());
    schedule.reloadCurrentScheduleSilently = vi.fn(() => Promise.resolve(false));
    await schedule.refresh();
    expect(useToast().toasts.value.at(-1).message).toBe("Planning à jour");
  });

  it("does not try while offline", async () => {
    const schedule = useScheduleStore();
    useServerStore().isOnline = false;
    await schedule.refresh();
    expect(useToast().toasts.value.at(-1)).toMatchObject({ type: "error" });
  });
});
