import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.ZAY_BASE_PATH || "/",
  plugins: [react()],
  build: {
    outDir: "dist/pwa",
    rollupOptions: { input: "pwa.html" },
    chunkSizeWarningLimit: 900,
  },
});
