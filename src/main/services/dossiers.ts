/**
 * Emplacements des dossiers de données de l'application.
 * En production : dossier userData de la machine ; en dev : racine du projet.
 */
import { app } from 'electron'
import path from 'path'

function base(): string {
  return app.isPackaged ? app.getPath('userData') : process.cwd()
}

/** Dossier des reçus PDF générés. */
export function getRecusDir(): string {
  return path.join(base(), 'recus')
}

/** Dossier des rapports exportés (PDF et Excel). */
export function getRapportsDir(): string {
  return path.join(base(), 'rapports')
}
