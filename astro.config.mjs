// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import react from '@astrojs/react';

// `site` powers canonical URLs, sitemap.xml, and absolute OG/Twitter image
// URLs. Update this if a custom domain replaces the Vercel one.
export default defineConfig({
  site: 'https://maurogenna.dev',
  integrations: [sitemap(), react()],
  build: {
    inlineStylesheets: 'auto',
  },
});