import antfu from "@antfu/eslint-config";

export default antfu(
  {
    type: "app",
    typescript: true,
    formatters: true,
    stylistic: {
      indent: 2,
      semi: true,
      quotes: "double",
    },
    ignores: ["**/migrations/*", "**/node_modules/*", "**/dist/*", "**/modules/*"],
  },
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@edaya/authorization",
          importNames: ["Permission"],
          message: "Import Permission from @edaya/core — it is defined there and only re-exported from authorization.",
        }],
      }],
      "no-console": ["error", { allow: ["error"] }],
      "antfu/no-top-level-await": ["off"],
      "node/prefer-global/process": ["off"],
      "node/no-process-env": ["error"],
      "perfectionist/sort-imports": ["off"],
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: ["README.md"],
        },
      ],
    },
  },
);
