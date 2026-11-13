import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Static-first (ADR 0004): every route is prerendered to HTML at build time.
export default defineConfig({
  server: { port: 3000 },
  plugins: [tanstackStart({ prerender: { enabled: true, crawlLinks: true } }), viteReact()],
});
