import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // A toast from "sonner" itself renders with sonner's default styling, not
  // the app's animated card, so callers go through the Rare UI wrapper.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/rare/toast.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "sonner", message: "Import toast from \"@/components/ui/rare/toast\" instead." }],
      }],
    },
  },
]);

export default eslintConfig;
