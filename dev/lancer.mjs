/**
 * Lance le banc de test complet avec rechargement automatique :
 * - serveur des handlers réels, relancé à chaque modification du code
 *   du processus principal (tsx watch) ;
 * - serveur Vite avec HMR pour l'interface (les modifications du renderer
 *   s'affichent sans rafraîchir la page).
 *
 * Usage : npm run test:app:dev  →  http://localhost:5200
 */
import { spawn } from 'child_process'

const processus = [
  spawn('npx', ['tsx', 'watch', '--tsconfig', 'dev/tsconfig.json', 'dev/serveur-test.ts'], {
    stdio: 'inherit'
  }),
  spawn('npx', ['vite', '--config', 'dev/vite.config.ts'], { stdio: 'inherit' })
]

// Si l'un des deux s'arrête, on arrête l'autre proprement.
for (const p of processus) {
  p.on('exit', (code) => {
    for (const autre of processus) autre.kill()
    process.exit(code ?? 0)
  })
}
