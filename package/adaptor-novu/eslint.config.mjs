import antfu from "@antfu/eslint-config";

export default antfu(
  {
    type: "lib",
    typescript: true,
    formatters: false,
    stylistic: {
      indent: 2,
      semi: true,
      quotes: "double",
    },
    ignores: ["**/node_modules/*", "**/dist/*", "bootstrap/**"],
  },
  {
    rules: {
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
