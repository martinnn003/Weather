import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative paths keep the build deployable from any subdirectory.
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.{js,jsx}"]
  }
});
