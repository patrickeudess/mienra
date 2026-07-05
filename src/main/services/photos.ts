/**
 * Stockage des photos d'élèves sur le disque (pas en base, pour garder une
 * base légère à sauvegarder). Le renderer envoie le fichier en base64 ; le
 * main l'écrit dans le dossier "photos" et renvoie une data-URL à afficher.
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { PhotoInput } from '@shared/types'

const MIME: Record<PhotoInput['extension'], string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

/** Taille maximale acceptée pour une photo (2 Mo). */
const TAILLE_MAX_OCTETS = 2 * 1024 * 1024

function getPhotosDir(): string {
  const base = app.isPackaged ? app.getPath('userData') : process.cwd()
  return path.join(base, 'photos')
}

/**
 * Enregistre la photo d'un élève (remplace l'ancienne le cas échéant).
 * Retourne le chemin absolu du fichier écrit, ou une erreur si trop lourde.
 */
export function enregistrerPhoto(
  matricule: string,
  photo: PhotoInput
): { ok: true; chemin: string } | { ok: false; erreur: string } {
  const donnees = Buffer.from(photo.dataBase64, 'base64')
  if (donnees.byteLength > TAILLE_MAX_OCTETS) {
    return { ok: false, erreur: 'La photo dépasse 2 Mo. Choisissez une image plus légère.' }
  }

  const dir = getPhotosDir()
  fs.mkdirSync(dir, { recursive: true })
  const chemin = path.join(dir, `${matricule}.${photo.extension}`)
  fs.writeFileSync(chemin, donnees)
  return { ok: true, chemin }
}

/** Lit une photo enregistrée et la retourne en data-URL (null si absente). */
export function lirePhotoDataUrl(chemin: string | null): string | null {
  if (!chemin || !fs.existsSync(chemin)) return null
  const extension = path.extname(chemin).slice(1).toLowerCase() as PhotoInput['extension']
  const mime = MIME[extension]
  if (!mime) return null
  return `data:${mime};base64,${fs.readFileSync(chemin).toString('base64')}`
}

/** Supprime la photo d'un élève si elle existe. */
export function supprimerPhoto(chemin: string | null): void {
  if (chemin && fs.existsSync(chemin)) fs.unlinkSync(chemin)
}
