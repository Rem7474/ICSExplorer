import { createApp } from "vue";
import SpikeApp from "./SpikeApp.vue";
import { vuetify } from "./vuetify.js";

createApp(SpikeApp).use(vuetify).mount("#app");
