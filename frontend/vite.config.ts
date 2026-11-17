import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig(({ mode }) => ({
  define: mode === 'cloudflare' ? { 'import.meta.env.VITE_SYNC_CONFIGURED': JSON.stringify(String(Boolean(process.env.API_ORIGIN?.trim()))) } : {},
  plugins: [react(), ...(mode === 'cloudflare' ? [cloudflare({ viteEnvironment: { name: 'worker' } })] : []), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
    manifest: {
      name: 'Em Casa • Visita domiciliar ESF', short_name: 'Em Casa', lang: 'pt-BR',
      description: 'Registros de visita domiciliar com evolução SOAP.',
      theme_color: '#145b49', background_color: '#f5f6f2', display: 'standalone', start_url: '/',
      icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallbackDenylist: [/^\/visits/, /^\/health/], cleanupOutdatedCaches: true },
  })],
  server: { port: mode === 'cloudflare' ? 8787 : 5173, strictPort: mode === 'cloudflare', proxy: mode === 'cloudflare' ? undefined : { '/visits': 'http://127.0.0.1:8000', '/health': 'http://127.0.0.1:8000' } },
  preview: { proxy: mode === 'cloudflare' ? undefined : { '/visits': 'http://127.0.0.1:8000', '/health': 'http://127.0.0.1:8000' } },
}))
