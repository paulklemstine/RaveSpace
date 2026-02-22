import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), glsl()],
  resolve: {
    alias: {
      // Package has broken exports (files at dist/dist/ but exports say dist/)
      "realtime-bpm-analyzer": path.resolve(
        __dirname,
        "node_modules/realtime-bpm-analyzer/dist/dist/index.esm.js",
      ),
    },
  },
  server: {
    watch: {
      usePolling: true,
    },
  },
});
