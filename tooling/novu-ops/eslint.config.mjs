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
    ignores: ["**/node_modules/*", "**/dist/*"],
  },
  {
    rules: {
      "antfu/no-top-level-await": "off",
      "node/prefer-global/process": "off",
      "no-console": "off",
      "perfectionist/sort-imports": ["off"],
      "ts/explicit-function-return-type": "off",
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
