// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// `site` powers canonical URLs, sitemap.xml, and absolute OG/Twitter image
// URLs. Update this if a custom domain replaces the Vercel one.
export default defineConfig({
  site: 'https://maurogenna.dev',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // Astro 7 minifies CSS with Lightning CSS, which compiles to whatever
      // targets it is given. Left unset it assumes very recent browsers and
      // emits media-query range syntax (`width <= 760px`), which Safari only
      // understands from 16.4. These targets keep the output compatible.
      cssTarget: ['chrome100', 'edge100', 'firefox115', 'safari15.4'],
    },
  },
});
