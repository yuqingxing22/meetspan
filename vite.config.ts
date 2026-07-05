import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base: "./" makes all asset URLs relative, so the app works on any
// GitHub Pages path (https://<user>.github.io/<repo>/) without hardcoding it.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
