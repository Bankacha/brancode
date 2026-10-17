import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "src/**/*.test.jsx", "scripts/**/*.test.mjs"],
    setupFiles: ["./src/test/setup.js"],
  },
});
