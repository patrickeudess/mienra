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

/** Motif strict des noms de sauvegarde (empêche toute traversée de chemin). */
const MOTIF_SAUVEGARDE = /^mienra-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/

export interface SauvegardeFichier {
  nom: string
  chemin: string
  date: Date
  taille: number // octets
}

/** Liste les sauvegardes existantes, la plus récente en premier. */
export function listerSauvegardes(): SauvegardeFichier[] {
  const dir = getBackupDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => MOTIF_SAUVEGARDE.test(f))
    .sort()
    .reverse()
    .map((nom) => {
      const chemin = path.join(dir, nom)
      const stat = fs.statSync(chemin)
      return { nom, chemin, date: stat.mtime, taille: stat.size }
    })
}

/**
 * Résout le chemin d'une sauvegarde à partir de son nom, en le validant.
 * Retourne null si le nom est invalide ou si le fichier n'existe pas.
 */
export function resoudreSauvegarde(nom: string): string | null {
  if (!MOTIF_SAUVEGARDE.test(nom)) return null
  const chemin = path.join(getBackupDir(), nom)
  return fs.existsSync(chemin) ? chemin : null
}

/**
 * Remplace la base courante par la sauvegarde donnée. La connexion à la
 * base doit être fermée AVANT l'appel ; une sauvegarde de secours de la
 * base actuelle est créée d'abord. Retourne le chemin de ce filet de
 * sécurité (null si la base n'existait pas).
 */
export function restaurerSauvegarde(cheminSauvegarde: string): string | null {
  const filetSecurite = createBackup()
  fs.copyFileSync(cheminSauvegarde, getDatabasePath())
  return filetSecurite
}
