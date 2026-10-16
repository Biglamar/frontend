import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Type-aware rules to catch floating promises and misused promises (#646, #647).
  // projectService is required for typed linting.
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  // Extends (not just restates) eslint-config-next's default ignores with
  // /coverage — Jest/Istanbul writes a static HTML report bundle there
  // (see .gitignore's "# testing" / "/coverage" entry) that isn't source
  // code and shouldn't be linted (#252).
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Added on top of the defaults above:
    "coverage/**",
  ]),
]);

export default eslintConfig;
