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
  },
  referentiel: {
    classes: 'referentiel:classes',
    annees: 'referentiel:annees'
  },
  inscriptions: {
    list: 'inscriptions:list',
    create: 'inscriptions:create',
    update: 'inscriptions:update',
    delete: 'inscriptions:delete'
  },
  paiements: {
    list: 'paiements:list',
    create: 'paiements:create',
    historique: 'paiements:historique',
    delete: 'paiements:delete'
  }
} as const
