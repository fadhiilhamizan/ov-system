import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// ============================================================
// Two projects, split by file extension.
//
// `include` used to be `src/**/*.test.ts` with `environment: "node"`, which
// meant a `.test.tsx` file was silently NOT RUN: no error, no skip notice, just
// a test suite that quietly did not exist. That is why ~130 components had zero
// coverage while the suite reported 456 passing tests, and why two remount /
// stale-props bugs in the rundown table shipped without anything catching them.
//
// The split keeps the pure-logic tests on `node` (they are the bulk, and jsdom
// would only slow them down) while `.test.tsx` automatically gets a DOM. It is
// automatic on purpose: a per-file `@vitest-environment` docblock works too,
// but forgetting it is exactly the class of silent omission this replaces.
// ============================================================
const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` is a build-time guard provided by Next; it has no Node
  // resolution, so importing a server module under Vitest fails outright.
  // Point it at an empty stub - the guard still applies in `next build`,
  // which is where it matters.
  "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "logic",
          environment: "node",
          include: ["src/**/*.{test,spec}.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.{test,spec}.tsx"],
          setupFiles: ["./src/test/setup-dom.ts"],
        },
      },
    ],
  },
});
