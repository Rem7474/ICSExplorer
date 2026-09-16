import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
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
  envPrefix: ["VITE_", "PRIMEUI_"],
  plugins: [vue(), serviceWorkerVersionPlugin(appVersion)],
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
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.js"],
  },
});
