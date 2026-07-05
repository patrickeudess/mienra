/**
 * Sauvegarde automatique de la base de données.
 *
 * À chaque fermeture de l'application, une copie horodatée du fichier SQLite
 * est créée dans le dossier "backups" (userData en production). Seules les
 * dix sauvegardes les plus récentes sont conservées.
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDatabasePath } from './client'

const MAX_BACKUPS = 10

/** Dossier où sont stockées les sauvegardes. */
export function getBackupDir(): string {
  const base = app.isPackaged ? app.getPath('userData') : process.cwd()
  return path.join(base, 'backups')
}

/**
 * Crée une sauvegarde horodatée de la base, puis supprime les plus anciennes
 * au-delà de MAX_BACKUPS. Retourne le chemin du fichier créé, ou null si la
 * base n'existe pas encore.
 */
export function createBackup(): string | null {
  const dbPath = getDatabasePath()
  if (!fs.existsSync(dbPath)) return null

  const dir = getBackupDir()
  fs.mkdirSync(dir, { recursive: true })

  // Horodatage lisible et triable : mienra-2026-07-05_14-30-00.db
  const stamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19)
  const backupPath = path.join(dir, `mienra-${stamp}.db`)
  fs.copyFileSync(dbPath, backupPath)

  purgeOldBackups(dir)
  return backupPath
}

/** Supprime les sauvegardes les plus anciennes au-delà de la limite. */
function purgeOldBackups(dir: string): void {
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('mienra-') && f.endsWith('.db'))
    .sort() // l'horodatage dans le nom rend le tri chronologique
  const excedent = backups.length - MAX_BACKUPS
  for (let i = 0; i < excedent; i++) {
    fs.unlinkSync(path.join(dir, backups[i]))
  }
}
