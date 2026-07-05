/**
 * Garde-fous de la gestion des utilisateurs, découplés d'Electron pour être
 * testables. Utilisés par les handlers IPC du module Utilisateurs.
 */
import type { PrismaClient } from '@prisma/client'

/** Vérifie que l'auteur de l'appel est un administrateur actif. */
export async function verifierAdmin(
  prisma: PrismaClient,
  auteurId: number
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const auteur = await prisma.utilisateur.findUnique({ where: { id: auteurId } })
  if (!auteur || !auteur.actif || auteur.role !== 'ADMINISTRATEUR') {
    return { ok: false, erreur: 'Seul un administrateur peut gérer les utilisateurs.' }
  }
  return { ok: true }
}

/** Vrai si `id` est le dernier administrateur actif de l'application. */
export async function estDernierAdminActif(prisma: PrismaClient, id: number): Promise<boolean> {
  const cible = await prisma.utilisateur.findUnique({ where: { id } })
  if (!cible || cible.role !== 'ADMINISTRATEUR' || !cible.actif) return false
  const autresAdminsActifs = await prisma.utilisateur.count({
    where: { role: 'ADMINISTRATEUR', actif: true, id: { not: id } }
  })
  return autresAdminsActifs === 0
}
