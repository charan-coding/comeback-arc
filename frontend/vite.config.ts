import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this app from a /<repo-name>/ subpath; Netlify/Vercel serve it from
// the root. The deploy workflow sets GH_PAGES=true only when building for Pages.
const base = process.env.GH_PAGES === 'true' ? '/comeback-arc/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Comeback Arc',
        short_name: 'ComebackArc',
        description: 'A tabletop-RPG themed habit tracker for small parties of friends.',
        theme_color: '#1b1420',
        background_color: '#1b1420',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
  },
});
