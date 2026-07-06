/**
 * Serveur de développement navigateur (rechargement automatique).
 *
 * Sert l'interface React avec le HMR de Vite : chaque modification du code
 * du renderer s'affiche instantanément, sans rafraîchir la page. Les appels
 * window.api sont relayés vers le serveur de test (port 5199) qui exécute
 * les vrais handlers IPC — relancé automatiquement par `tsx watch` quand le
 * code du processus principal change.
 *
 * Usage : npm run test:app:dev  →  http://localhost:5200
 */
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Prépare index.html pour le mode navigateur :
 * - injecte le pont window.api (servi par le serveur de test) ;
 * - retire la méta CSP, incompatible avec les scripts inline du HMR
 *   (elle reste bien sûr active dans l'application Electron).
 */
function pontApi(): Plugin {
  return {
    name: 'mienra-pont-api',
    transformIndexHtml(html) {
      return html
        .replace(/<meta[^>]*Content-Security-Policy[\s\S]*?\/>/, '')
        .replace('<head>', '<head>\n    <script src="/api-bridge.js"></script>')
    }
  }
}

export default defineConfig({
  root: path.resolve(__dirname, '../src/renderer'),
  plugins: [react(), pontApi()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src/renderer/src'),
      '@shared': path.resolve(__dirname, '../src/shared')
    }
  },
  server: {
    port: 5200,
    strictPort: true,
    proxy: {
      '/ipc': 'http://localhost:5199',
      '/api-bridge.js': 'http://localhost:5199'
    }
  }
})
