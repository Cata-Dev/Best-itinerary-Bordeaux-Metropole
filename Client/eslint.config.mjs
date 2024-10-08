// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueTsEslintConfig from "@vue/eslint-config-typescript";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // @ts-ignore
  ...pluginVue.configs["flat/recommended"],
  ...vueTsEslintConfig(),
  eslintConfigPrettier,
  {
    plugins: {
      "typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        project: "./tsconfig.json",
        extraFileExtensions: [".vue"],
        sourceType: "module",
      },
    },
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
    },
  },
);
