import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    assetsDir: "assets",
    chunkSizeWarningLimit: 800,
    outDir: "dist",
    sourcemap: false,
  },
});
