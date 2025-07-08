import pluginVue from "eslint-plugin-vue";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import prettierConfig from "@vue/eslint-config-prettier";

export default defineConfigWithVueTs(
  {
    name: "app/files-to-lint",
    files: ["**/*.{ts,mts,tsx,vue}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { caughtErrorsIgnorePattern: "^_+$", argsIgnorePattern: "^_+$", varsIgnorePattern: "^_+$" },
      ],
      "no-empty": [
        "warn",
        {
          allowEmptyCatch: true,
        },
      ],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    name: "app/files-to-ignore",
    ignores: ["**/dist", "**/dist-ssr/**", "**/coverage"],
  },
  ...pluginVue.configs["flat/recommended"],
  // https://github.com/vuejs/eslint-config-typescript#readme
  vueTsConfigs.strictTypeChecked,
  vueTsConfigs.stylisticTypeChecked,
  // https://github.com/vuejs/eslint-config-prettier#readme
  prettierConfig,
);
