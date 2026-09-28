import { beforeEach } from "vitest";
import { config } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PrimeVue from "primevue/config";
import Aura from "@primeuix/themes/aura";

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
  config.global.plugins = [primeVuePlugin, pinia];
});
