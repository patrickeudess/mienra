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
  },
  eleves: {
    list: 'eleves:list',
    get: 'eleves:get',
    create: 'eleves:create',
    update: 'eleves:update',
    delete: 'eleves:delete'
  }
} as const
