// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

import preact from "@astrojs/preact";

// https://astro.build/config
export default defineConfig({
  site: "https://x.zcgo.top",
  adapter: cloudflare(),
  integrations: [preact()],
});