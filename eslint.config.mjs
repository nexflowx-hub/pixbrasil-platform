import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "no-debugger": "error",
      "no-unreachable": "error",
      "react-hooks/exhaustive-deps": "error",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-console": ["error", { "allow": ["warn", "error"] }]
    }
  },
  { ignores: ["node_modules/**",".next/**","out/**","build/**","next-env.d.ts","examples/**",".zscripts/**","skills/**","public/**"] }
];

export default eslintConfig;
