// Stand-in for Next's `server-only` package under Vitest (see vitest.config.ts).
// Importing the real one outside a Next build throws, which would make any test
// that touches a server module fail to load. Deliberately empty.
export {};
