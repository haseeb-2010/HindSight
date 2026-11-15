import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api': { target: env.HINDSIGHT_API_PROXY || 'http://127.0.0.1:8000', changeOrigin: true },
  }
  // The public address of the site, used for link previews (they need absolute URLs).
  // Set VITE_SITE_URL at build time if the site moves to another domain.
  const siteUrl = (env.VITE_SITE_URL || 'https://tryhindsight-bdd8hufna5e8bpgz.westus3-01.azurewebsites.net').replace(/\/+$/, '')
  const sitePlugin = {
    name: 'hindsight-site-url',
    transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', siteUrl),
  }
  return {
    plugins: [react(), tailwindcss(), sitePlugin],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  }
})
