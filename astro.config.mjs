import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// The Netlify adapter's local emulation tries to boot an Edge Functions server
// (Deno) during `astro dev`, which fails on many machines. Envelope doesn't use
// edge functions, so the adapter only loads for builds.
const isDev = process.argv.includes('dev');

export default defineConfig({
  output: 'server',
  adapter: isDev ? undefined : netlify(),
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
});