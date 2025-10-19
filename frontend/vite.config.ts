import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(() => ({
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        interceptor: resolve(__dirname, "src/interceptor.ts"),
        instructionsPanel: resolve(
          __dirname,
          "src/instructions-panel.ts"
        ),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "interceptor") {
            return "assets/interceptor.js";
          }
          if (chunkInfo.name === "instructionsPanel") {
            return "assets/instructions-panel.js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
      },
      "/__vaporvibe": {
        target: "http://localhost:3000",
      },
      "/vaporvibe": {
        target: "http://localhost:3000",
      },
      "/__setup": {
        target: "http://localhost:3000",
      },
    },
  },
}));
