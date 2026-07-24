import { defineConfig } from "vite";

// Base is set to "./" so the built site works from any sub-path
// (e.g. GitHub Pages project sites: username.github.io/rowing-trainer/).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
