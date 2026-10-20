import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        game: resolve(import.meta.dirname, "index.html"),
        character: resolve(import.meta.dirname, "character.html"),
      },
      output: { manualChunks: { engine: ["three"] } },
    },
  },
});
