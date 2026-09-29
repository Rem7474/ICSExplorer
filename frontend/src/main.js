import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router/index.js";
import { vuetify } from "./plugins/vuetify.js";
import App from "./App.vue";
import "./styles/main.css";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(vuetify);

app.mount("#app");

// Register Service Worker in production / supported environments
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    const promptUserToUpdate = (worker) => {
      window.dispatchEvent(
        new CustomEvent("pwa-update-available", {
          detail: {
            update: () => {
              if (worker) {
                worker.postMessage({ type: "SKIP_WAITING" });
              } else {
                window.location.reload();
              }
            },
          },
        })
      );
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // If an update is already waiting to activate
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUserToUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              promptUserToUpdate(newWorker);
            }
          });
        });

        // Periodically check for SW updates (every 60 min)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);

        // Check for updates when user returns to the tab
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch(() => {});
  });
}
