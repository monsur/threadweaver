import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Threadweaver',
        short_name: 'Threadweaver',
        description: 'Bluesky thread authoring tool',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [],
      },
      workbox: {
        // Cache the app shell (HTML, JS, CSS, assets)
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Serve cached index.html for navigation requests when offline
        navigateFallback: 'index.html',
        // Never cache API calls — let the app's IDB layer handle data offline
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
