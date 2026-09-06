import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./*" alias so test files can import
// modules the same way app code does, without pulling in Next.js's own
// build tooling (this project has no other test infra yet — see
// lib/pointCloudAlign.test.ts for what this currently covers).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
