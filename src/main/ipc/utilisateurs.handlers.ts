/**
 * Handlers IPC du module Utilisateurs — réservés à l'Administrateur.
 *
 * Garde-fous (vérifiés en base, jamais seulement dans l'interface) :
 * - toutes les opérations exigent le rôle ADMINISTRATEUR ;
 * - un compte ne peut pas se désactiver ni se rétrograder lui-même ;
 * - le dernier administrateur actif ne peut être ni désactivé ni rétrogradé ;
 * - pas de suppression : un compte peut être caissier de paiements passés,
 *   la désactivation bloque la connexion en préservant l'historique.
 */
import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { estDernierAdminActif, verifierAdmin } from '../services/utilisateursGuards'
import { IPC } from '@shared/ipc'
import {
  motDePasseSchema,
  ROLE_LABELS,
  roleSchema,
  utilisateurInputSchema,
  utilisateurUpdateSchema,
  type OperationResult,
  type UtilisateurListItem
} from '@shared/types'

const idSchema = z.number().int().positive()

export function registerUtilisateursHandlers(): void {
  // ------------------------------------------------------------------ liste
  ipcMain.handle(
    IPC.utilisateurs.list,
    async (_e, auteurId: number): Promise<OperationResult<UtilisateurListItem[]>> => {
      const admin = await verifierAdmin(getPrisma(), idSchema.parse(auteurId))
      if (!admin.ok) return admin

      const utilisateurs = await getPrisma().utilisateur.findMany({ orderBy: { nom: 'asc' } })
      return {
        ok: true,
        data: utilisateurs.map((u) => ({
          id: u.id,
          nom: u.nom,
          identifiant: u.identifiant,
          role: roleSchema.catch('SECRETAIRE_COMPTABLE').parse(u.role),
          actif: u.actif,
          creeLe: u.creeLe.toISOString()
        }))
      }
    }
  )

  // --------------------------------------------------------------- création
  ipcMain.handle(
    IPC.utilisateurs.create,
    async (_e, input: unknown, auteurId: number): Promise<OperationResult<{ id: number }>> => {
      const admin = await verifierAdmin(getPrisma(), idSchema.parse(auteurId))
      if (!admin.ok) return admin

      const parsed = utilisateurInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const prisma = getPrisma()

      const existant = await prisma.utilisateur.findUnique({
        where: { identifiant: parsed.data.identifiant }
      })
      if (existant) return { ok: false, erreur: 'Cet identifiant est déjà utilisé.' }

      const utilisateur = await prisma.utilisateur.create({
        data: {
          nom: parsed.data.nom,
          identifiant: parsed.data.identifiant,
          motDePasse: await bcrypt.hash(parsed.data.motDePasse, 10),
          role: parsed.data.role
        }
      })

      await journaliser('GESTION_UTILISATEUR', {
        utilisateurId: auteurId,
        details: `Création du compte ${utilisateur.identifiant} (${ROLE_LABELS[parsed.data.role]})`
      })
      return { ok: true, data: { id: utilisateur.id } }
    }
  )

  // ----------------------------------------------------------- modification
  ipcMain.handle(
    IPC.utilisateurs.update,
    async (_e, id: number, input: unknown, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifierAdmin(getPrisma(), idSchema.parse(auteurId))
      if (!admin.ok) return admin

      const parsed = utilisateurUpdateSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const cibleId = idSchema.parse(id)
      const prisma = getPrisma()

      const cible = await prisma.utilisateur.findUnique({ where: { id: cibleId } })
      if (!cible) return { ok: false, erreur: 'Utilisateur introuvable.' }

      const retrograde = cible.role === 'ADMINISTRATEUR' && parsed.data.role !== 'ADMINISTRATEUR'
      if (retrograde && cibleId === auteurId) {
        return { ok: false, erreur: 'Vous ne pouvez pas retirer votre propre rôle d’administrateur.' }
      }
      if (retrograde && (await estDernierAdminActif(prisma, cibleId))) {
        return { ok: false, erreur: 'Impossible : ce compte est le dernier administrateur actif.' }
      }

      await prisma.utilisateur.update({ where: { id: cibleId }, data: parsed.data })

      await journaliser('GESTION_UTILISATEUR', {
        utilisateurId: auteurId,
        details: `Modification du compte ${cible.identifiant} (${ROLE_LABELS[parsed.data.role]})`
      })
      return { ok: true, data: null }
    }
  )

  // ------------------------------------------- activation / désactivation
  ipcMain.handle(
    IPC.utilisateurs.setActif,
    async (_e, id: number, actif: boolean, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifierAdmin(getPrisma(), idSchema.parse(auteurId))
      if (!admin.ok) return admin

      const cibleId = idSchema.parse(id)
      const nouvelActif = z.boolean().parse(actif)
      const prisma = getPrisma()

      const cible = await prisma.utilisateur.findUnique({ where: { id: cibleId } })
      if (!cible) return { ok: false, erreur: 'Utilisateur introuvable.' }

      if (!nouvelActif && cibleId === auteurId) {
        return { ok: false, erreur: 'Vous ne pouvez pas désactiver votre propre compte.' }
      }
      if (!nouvelActif && (await estDernierAdminActif(prisma, cibleId))) {
        return { ok: false, erreur: 'Impossible : ce compte est le dernier administrateur actif.' }
      }

      await prisma.utilisateur.update({ where: { id: cibleId }, data: { actif: nouvelActif } })

      await journaliser('GESTION_UTILISATEUR', {
        utilisateurId: auteurId,
        details: `${nouvelActif ? 'Activation' : 'Désactivation'} du compte ${cible.identifiant}`
      })
      return { ok: true, data: null }
    }
  )

  // ------------------------------------------- réinitialisation mot de passe
  ipcMain.handle(
    IPC.utilisateurs.resetMotDePasse,
    async (_e, id: number, motDePasse: unknown, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifierAdmin(getPrisma(), idSchema.parse(auteurId))
      if (!admin.ok) return admin

      const parsed = motDePasseSchema.safeParse(motDePasse)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Mot de passe invalide.' }
      }
      const cibleId = idSchema.parse(id)
      const prisma = getPrisma()

      const cible = await prisma.utilisateur.findUnique({ where: { id: cibleId } })
      if (!cible) return { ok: false, erreur: 'Utilisateur introuvable.' }

      await prisma.utilisateur.update({
        where: { id: cibleId },
        data: { motDePasse: await bcrypt.hash(parsed.data, 10) }
      })

      await journaliser('GESTION_UTILISATEUR', {
        utilisateurId: auteurId,
        details: `Réinitialisation du mot de passe de ${cible.identifiant}`
      })
      return { ok: true, data: null }
    }
  )
}
