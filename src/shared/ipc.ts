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
  },
  recus: {
    imprimer: 'recus:imprimer',
    ouvrirDossier: 'recus:ouvrirDossier'
  },
  impayes: {
    list: 'impayes:list'
  },
  rapports: {
    generer: 'rapports:generer',
    exporter: 'rapports:exporter'
  },
  journal: {
    list: 'journal:list',
    utilisateurs: 'journal:utilisateurs'
  },
  utilisateurs: {
    list: 'utilisateurs:list',
    create: 'utilisateurs:create',
    update: 'utilisateurs:update',
    setActif: 'utilisateurs:setActif',
    resetMotDePasse: 'utilisateurs:resetMotDePasse'
  }
} as const
