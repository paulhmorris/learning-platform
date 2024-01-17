/**
 * This is intended to be a basic starting point for linting in the Blues Stack.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
        "prettier",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
      },
      rules: {
        "react/prop-types": "off",
        "react/jsx-no-leaked-render": ["warn", { validStrategies: ["ternary"] }],
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended-type-checked",
        "plugin:@typescript-eslint/stylistic",
        "plugin:import/recommended",
        "plugin:import/typescript",
        "prettier",
      ],
      rules: {
        "no-console": ["warn", { allow: ["warn", "error", "info"] }],
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/array-type": ["error", { default: "generic" }],
        "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
        "@typescript-eslint/no-misused-promises": [
          "error",
          {
            checksVoidReturn: false,
          },
        ],
        "@typescript-eslint/no-unnecessary-condition": "warn",
        "import/order": [
          "error",
          {
            alphabetize: { caseInsensitive: true, order: "asc" },
            groups: ["builtin", "external", "internal", "parent", "sibling"],
            "newlines-between": "always",
          },
        ],
      },
    },

    // Markdown
    {
      files: ["**/*.md"],
      plugins: ["markdown"],
      extends: ["plugin:markdown/recommended", "prettier"],
    },

    // Jest/Vitest
    {
      files: ["test/**/*.test.{js,jsx,ts,tsx}"],
      plugins: ["jest", "jest-dom", "testing-library"],
      extends: ["plugin:jest/recommended", "plugin:jest-dom/recommended", "plugin:testing-library/react", "prettier"],
      env: {
        "jest/globals": true,
      },
      settings: {
        jest: {
          // we're using vitest which has a very similar API to jest
          // (so the linting plugins work nicely), but it means we have to explicitly
          // set the jest version.
          version: 28,
        },
      },
    },

    // Playwright
    {
      files: ["playwright/**/*.ts"],
      extends: ["plugin:playwright/recommended"],
    },

    // Node
    {
      files: [".eslintrc.js", "mocks/**/*.js"],
      env: {
        node: true,
      },
    },
  ],
};
