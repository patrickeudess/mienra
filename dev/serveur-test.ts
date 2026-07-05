/**
 * Serveur de test : lance la VRAIE application dans un navigateur.
 *
 * - Les handlers IPC réels (src/main/ipc) sont enregistrés avec le module
 *   « electron » remplacé par dev/electron-stub.ts (alias tsconfig).
 * - L'interface compilée (out/renderer) est servie en HTTP, avec un pont
 *   window.api généré automatiquement depuis la carte des canaux IPC :
 *   chaque appel devient un POST /ipc dirigé vers le vrai handler.
 * - La base utilisée est prisma/dev.db (comme en développement).
 *
 * Usage :  npm run build && npm run test:app  →  http://localhost:5199
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import { registerIpcHandlers } from '../src/main/ipc'
import { getHandlers } from './electron-stub'
import { IPC } from '../src/shared/ipc'

const PORT = 5199
const RENDERER = path.resolve(process.cwd(), 'out', 'renderer')

if (!fs.existsSync(path.join(RENDERER, 'index.html'))) {
  console.error('Interface non compilée : lancez d’abord `npm run build`.')
  process.exit(1)
}

// Enregistre les handlers réels dans la Map du stub.
registerIpcHandlers()
const handlers = getHandlers()

// ---------------------------------------------------------------- pont api
// window.api est généré depuis la carte IPC : les noms de méthodes du
// preload sont identiques aux clés des canaux, le pont reste donc toujours
// synchronisé avec l'application.
function genererPont(): string {
  const modules = Object.entries(IPC)
    .map(([module, canaux]) => {
      const methodes = Object.entries(canaux)
        .map(([methode, canal]) => `${methode}: (...args) => invoke('${canal}', ...args)`)
        .join(', ')
      return `${module}: { ${methodes} }`
    })
    .join(',\n  ')
  return `// Pont window.api du serveur de test MIENRA (généré automatiquement)
const invoke = async (canal, ...args) => {
  const reponse = await fetch('/ipc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal, args })
  })
  const corps = await reponse.json()
  if (!corps.ok) throw new Error(corps.erreur)
  return corps.data
}
window.api = {
  ${modules}
}
`
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

const serveur = http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0]

  // Appels IPC → handlers réels.
  if (req.method === 'POST' && url === '/ipc') {
    let corps = ''
    req.on('data', (morceau) => (corps += morceau))
    req.on('end', () => {
      void (async () => {
        try {
          const { canal, args } = JSON.parse(corps) as { canal: string; args: unknown[] }
          const handler = handlers.get(canal)
          if (!handler) throw new Error(`Canal IPC inconnu : ${canal}`)
          const data = await handler(null, ...args)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, data }))
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, erreur: e instanceof Error ? e.message : String(e) }))
        }
      })()
    })
    return
  }

  // Pont injecté avant le script de l'application.
  if (url === '/api-bridge.js') {
    res.writeHead(200, { 'Content-Type': MIME['.js'] })
    res.end(genererPont())
    return
  }

  // Interface compilée. Le pont est injecté dans <head> : les scripts
  // classiques s'exécutent avant les modules, window.api existe donc
  // toujours quand React démarre.
  const fichier = url === '/' ? '/index.html' : url
  const chemin = path.join(RENDERER, path.normalize(fichier))
  if (!chemin.startsWith(RENDERER) || !fs.existsSync(chemin)) {
    res.writeHead(404)
    res.end('Introuvable')
    return
  }
  if (chemin.endsWith('index.html')) {
    const html = fs
      .readFileSync(chemin, 'utf8')
      .replace('<head>', '<head>\n    <script src="/api-bridge.js"></script>')
    res.writeHead(200, { 'Content-Type': MIME['.html'] })
    res.end(html)
    return
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(chemin)] ?? 'application/octet-stream' })
  res.end(fs.readFileSync(chemin))
})

serveur.listen(PORT, () => {
  console.log(`MIENRA (serveur de test) : http://localhost:${PORT}`)
  console.log('Base de données : prisma/dev.db — comptes du seed (admin/admin123…)')
})
