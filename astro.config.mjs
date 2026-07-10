// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// `site` powers canonical URLs, sitemap.xml, and absolute OG/Twitter image
// URLs. Update this if a custom domain replaces the Vercel one.
export default defineConfig({
  site: 'https://mauro-portfolio-iota.vercel.app',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
