/** Utilitaires fichiers côté interface. */
import type { PhotoInput } from '@shared/types'

/**
 * Convertit un fichier image choisi par l'utilisateur en PhotoInput
 * (base64 + extension) pour l'envoyer au processus principal.
 * Retourne null si le format n'est pas accepté.
 */
export async function fichierVersPhoto(fichier: File): Promise<PhotoInput | null> {
  const extension = fichier.name.split('.').pop()?.toLowerCase()
  if (extension !== 'jpg' && extension !== 'jpeg' && extension !== 'png' && extension !== 'webp') {
    return null
  }
  const buffer = await fichier.arrayBuffer()
  let binaire = ''
  const octets = new Uint8Array(buffer)
  for (let i = 0; i < octets.length; i++) binaire += String.fromCharCode(octets[i])
  return { dataBase64: btoa(binaire), extension }
}
