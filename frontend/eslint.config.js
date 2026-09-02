import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";

export default [
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      // Vue 3 specific
      "vue/multi-word-component-names": "off",
      "vue/no-unused-vars": "warn",
      "vue/require-default-prop": "off",
      // General JS quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    // Relax rules for test files
    files: ["src/__tests__/**/*.js", "src/**/*.spec.js"],
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/"],
  },
];
