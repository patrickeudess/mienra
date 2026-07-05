/**
 * Handlers IPC du module Authentification.
 * La vérification du mot de passe se fait exclusivement dans le processus
 * principal : le hash bcrypt ne quitte jamais la base.
 */
import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { IPC } from '@shared/ipc'
import { loginSchema, roleSchema, type LoginResult, type UtilisateurSession } from '@shared/types'

export function registerAuthHandlers(): void {
  ipcMain.handle(IPC.auth.login, async (_event, input: unknown): Promise<LoginResult> => {
    const parsed = loginSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, erreur: 'Identifiant ou mot de passe invalide.' }
    }

    const prisma = getPrisma()
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { identifiant: parsed.data.identifiant }
    })

    // Message volontairement identique que l'identifiant existe ou non,
    // pour ne pas révéler quels comptes existent.
    if (!utilisateur || !utilisateur.actif) {
      return { ok: false, erreur: 'Identifiant ou mot de passe incorrect.' }
    }
    const motDePasseValide = await bcrypt.compare(parsed.data.motDePasse, utilisateur.motDePasse)
    if (!motDePasseValide) {
      return { ok: false, erreur: 'Identifiant ou mot de passe incorrect.' }
    }

    const role = roleSchema.safeParse(utilisateur.role)
    if (!role.success) {
      return { ok: false, erreur: 'Rôle utilisateur inconnu. Contactez l’administrateur.' }
    }

    await journaliser('CONNEXION', { utilisateurId: utilisateur.id })

    const session: UtilisateurSession = {
      id: utilisateur.id,
      nom: utilisateur.nom,
      identifiant: utilisateur.identifiant,
      role: role.data
    }
    return { ok: true, utilisateur: session }
  })

  ipcMain.handle(IPC.auth.logout, async (_event, utilisateurId: number): Promise<void> => {
    if (typeof utilisateurId === 'number') {
      await journaliser('DECONNEXION', { utilisateurId })
    }
  })
}
