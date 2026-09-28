import { beforeEach } from "vitest";
import { config } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PrimeVue from "primevue/config";
import Aura from "@primeuix/themes/aura";
import { vuetify } from "../plugins/vuetify.js";

// Browser APIs used by Vuetify that jsdom does not implement.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
});
window.scrollTo ??= () => {};

const primeVuePlugin = [
  PrimeVue,
  {
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: ".dark-mode",
      },
    },
  },
];

// Each test gets fresh stores (the app state used to be recreated on every
// useSchedule() call before the Pinia split).
beforeEach(() => {
  const pinia = createPinia();
  setActivePinia(pinia);
  config.global.plugins = [primeVuePlugin, pinia, vuetify];
});
