import { createApp } from "vue";
import App from "./App.vue";
import "./styles/main.css";

const app = createApp(App);
app.mount("#app");

// Register Service Worker in production / supported environments
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
