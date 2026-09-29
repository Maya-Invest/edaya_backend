import antfu from "@antfu/eslint-config";

export default antfu(
  {
    type: "app",
    typescript: true,
    stylistic: {
      indent: 2,
      semi: true,
      quotes: "double",
    },
    ignores: ["**/node_modules/*", "**/dist/*"],
  },
  {
    rules: {
      "no-console": ["error", { allow: ["error", "log"] }],
      "antfu/no-top-level-await": ["off"],
      "node/prefer-global/process": ["off"],
      "perfectionist/sort-imports": ["off"],
    },
  },
);
