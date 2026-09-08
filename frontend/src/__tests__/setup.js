import { config } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";

config.global.plugins = [
  [
    PrimeVue,
    {
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: ".dark-mode",
        },
      },
    },
  ],
];
