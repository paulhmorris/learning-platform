import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    perf: "warn",
    suspicious: "warn",
    correctness: "error",
  },
  env: {
    builtin: true,
  },
  ignorePatterns: ["test-results"],
  overrides: [
    {
      files: ["src/**/*.test.ts"],
      plugins: ["vitest"],
    },
    {
      files: ["test/**"],
      rules: {
        "no-await-in-loop": "off",
      },
    },
  ],
  plugins: ["typescript", "unicorn", "oxc", "import", "react"],
  rules: {
    "import/no-unassigned-import": ["warn", { allow: ["**/*.css"] }],
    "no-underscore-dangle": "off",
    "unicorn/prefer-set-has": "off",
    "unicorn/consistent-function-scoping": "off",
    "react/react-in-jsx-scope": "off",
  },
});
