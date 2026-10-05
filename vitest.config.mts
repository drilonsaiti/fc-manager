import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { testTimeout: 60000, hookTimeout: 60000, environment: "node", include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts"] },
});
