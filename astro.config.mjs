// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://x.zcgo.top",
  output: "static",
  vite: {
    optimizeDeps: {
      exclude: ["astro:content", "astro/loaders", "astro/zod"],
    },
  },
});