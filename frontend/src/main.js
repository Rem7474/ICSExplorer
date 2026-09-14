import { createApp } from "vue";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import ToastService from "primevue/toastservice";
import "primeicons/primeicons.css";
import App from "./App.vue";
import "./styles/main.css";

const app = createApp(App);

const primeuiLicenseKey =
  (typeof window !== "undefined" && window.PRIMEUI_LICENSE) ||
  import.meta.env.PRIMEUI_LICENSE ||
  import.meta.env.VITE_PRIMEUI_LICENSE;

if (primeuiLicenseKey && typeof window !== "undefined") {
  window.PRIMEUI_LICENSE = primeuiLicenseKey;
}

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: ".dark-mode",
    },
  },
  ...(primeuiLicenseKey ? { licenseKey: primeuiLicenseKey, license: primeuiLicenseKey } : {}),
});
app.use(ToastService);

app.mount("#app");

// Register Service Worker in production / supported environments
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
