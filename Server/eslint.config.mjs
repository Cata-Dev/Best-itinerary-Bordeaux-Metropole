// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config({
  // @ts-ignore
  files: ["**/*.ts"],
  extends: [
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: true,
    },
  },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { caughtErrorsIgnorePattern: "^_+$", argsIgnorePattern: "^_+$", varsIgnorePattern: "^_+$" },
    ],
    indent: "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-empty-interface": ["warn"],
    "no-empty": [
      "warn",
      {
        allowEmptyCatch: true,
      },
    ],
    "@typescript-eslint/no-empty-object-type": [
      "error",
      {
        allowInterfaces: "always",
      },
    ],
  },
});
