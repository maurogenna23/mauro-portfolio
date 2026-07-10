// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// IMPORTANT: change `site` to your real deployed domain before shipping.
// It powers canonical URLs, sitemap.xml, and absolute OG/Twitter image URLs.
export default defineConfig({
  site: 'https://www.maurogenna.com',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
