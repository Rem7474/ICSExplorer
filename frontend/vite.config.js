import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8")
);

const rawVersion = process.env.VITE_APP_VERSION || packageJson.version || "dev";
const appVersion = rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`;
process.env.VITE_APP_VERSION = appVersion;

function serviceWorkerVersionPlugin(version) {
  return {
    name: "sw-version-plugin",
    closeBundle() {
      const swPath = fileURLToPath(new URL("./dist/sw.js", import.meta.url));
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, "utf-8");
        content = content.replace(
          /const CACHE_VERSION = ['"][^'"]+['"];/,
          `const CACHE_VERSION = 'edt-${version}';`
        );
        fs.writeFileSync(swPath, content, "utf-8");
      }
    },
  };
}

export default defineConfig({
  envDir: "../",
  envPrefix: ["VITE_"],
  plugins: [vue(), vuetify({ autoImport: true }), serviceWorkerVersionPlugin(appVersion)],
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: they change far less often than the app
        // code, so browsers keep them cached across releases.
        codeSplitting: {
          groups: [
            { name: "vuetify", test: /node_modules[\/]vuetify/ },
            { name: "vue", test: /node_modules[\/](vue|@vue|vue-router|pinia)[\/]/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/output": "http://localhost:8080",
      "/rooms": "http://localhost:8080",
    },
  },
  test: {
    // e2e/ holds Playwright specs, run separately with `npm run test:e2e`.
    include: ["src/**/*.{test,spec}.js"],
    environment: "jsdom",
    server: { deps: { inline: ["vuetify"] } },
    globals: true,
    setupFiles: ["./src/__tests__/setup.js"],
  },
});
