import "vuetify/styles";
import { createVuetify } from "vuetify";
import { md3 } from "vuetify/blueprints";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import { M3_PALETTE } from "./palette.js";

// iOS/iPadOS (including iPadOS reporting as Mac with touch).
export const isIOS =
  typeof navigator !== "undefined" &&
  (/iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const toTheme = (dark) => ({ dark, colors: { ...M3_PALETTE[dark ? "dark" : "light"] } });

export const vuetify = createVuetify({
  blueprint: md3,
  theme: {
    defaultTheme: "light",
    themes: { light: toTheme(false), dark: toTheme(true) },
  },
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  defaults: {
    // The Material ripple reads as "Android" on iPhone: use a plain pressed
    // state there instead (see .is-ios in styles/main.css).
    global: { ripple: !isIOS },
  },
});
