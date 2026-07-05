/**
 * Canaux IPC : constantes partagées entre main, preload et renderer.
 * Chaque module possède son préfixe pour rester indépendant.
 */
export const IPC = {
  auth: {
    login: 'auth:login',
    logout: 'auth:logout'
  },
  dashboard: {
    stats: 'dashboard:stats'
  }
} as const
