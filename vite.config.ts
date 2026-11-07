import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: '帧迹 Zhenji',
          short_name: '帧迹 Zhenji',
          description: 'Personal Movie & TV Watch Tracker · 个人影视进度追踪',
          theme_color: '#141417',
          background_color: '#121215',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,html,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//, /^\/healthz$/],
          // Precache the entry graph only; eager caching of lazy routes defeats code splitting on Slow 4G.
          manifestTransforms: [
            async (entries) => {
              const html = readFileSync(path.resolve('dist/index.html'), 'utf8');
              const initialScripts = new Set(
                [...html.matchAll(/(?:src|href)=["']([^"']+\.js)["']/g)].map((match) => match[1].replace(/^\//, '')),
              );
              return {
                manifest: entries.filter((entry) => !entry.url.endsWith('.js') || initialScripts.has(entry.url)),
                warnings: [],
              };
            },
          ],
          runtimeCaching: [
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js'),
              handler: 'CacheFirst',
              options: { cacheName: 'zhenji-route-code', expiration: { maxEntries: 64, maxAgeSeconds: 30 * 86400 } },
            },
          ],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
