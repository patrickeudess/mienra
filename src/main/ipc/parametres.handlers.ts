/**
 * Handlers IPC du module Paramètres — réservé à l'Administrateur.
 * - informations de l'école (nom, adresse, téléphone, logo des reçus) ;
 * - années scolaires : création et activation (une seule active) ;
 * - classes : création, modification, suppression (si aucune inscription).
 */
import { app, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { lirePhotoDataUrl } from '../services/photos'
import { verifierAdmin } from '../services/utilisateursGuards'
import { IPC } from '@shared/ipc'
import {
  anneeScolaireInputSchema,
  classeInputSchema,
  ecoleInputSchema,
  niveauSchema,
  type ClasseDetail,
  type EcoleInfo,
  type OperationResult,
  type PhotoInput
} from '@shared/types'

const idSchema = z.number().int().positive()

async function verifier(auteurId: number): Promise<{ ok: true } | { ok: false; erreur: string }> {
  return verifierAdmin(getPrisma(), idSchema.parse(auteurId))
}

/** Écrit le logo de l'école sur disque et retourne son chemin. */
function enregistrerLogo(logo: PhotoInput): { ok: true; chemin: string } | { ok: false; erreur: string } {
  const donnees = Buffer.from(logo.dataBase64, 'base64')
  if (donnees.byteLength > 2 * 1024 * 1024) {
    return { ok: false, erreur: 'Le logo dépasse 2 Mo. Choisissez une image plus légère.' }
  }
  const base = app.isPackaged ? app.getPath('userData') : process.cwd()
  const chemin = path.join(base, `logo.${logo.extension}`)
  fs.writeFileSync(chemin, donnees)
  return { ok: true, chemin }
}

export function registerParametresHandlers(): void {
  // ------------------------------------------------------------------ école
  ipcMain.handle(IPC.parametres.ecoleGet, async (): Promise<EcoleInfo> => {
    const ecole = await getPrisma().parametresEcole.findFirst()
    return {
      nom: ecole?.nom ?? 'Mon École',
      adresse: ecole?.adresse ?? '',
      telephone: ecole?.telephone ?? '',
      email: ecole?.email ?? '',
      code: ecole?.code ?? 'MIENRA',
      logoDataUrl: lirePhotoDataUrl(ecole?.logo ?? null),
      configuree: ecole?.configuree ?? false
    }
  })

  ipcMain.handle(
    IPC.parametres.ecoleUpdate,
    async (_e, input: unknown, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const parsed = ecoleInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const { logo, ...donnees } = parsed.data
      const prisma = getPrisma()

      let cheminLogo: string | undefined
      if (logo) {
        const resultat = enregistrerLogo(logo)
        if (!resultat.ok) return resultat
        cheminLogo = resultat.chemin
      }

      // L'enregistrement vaut validation de la configuration initiale.
      await prisma.parametresEcole.upsert({
        where: { id: 1 },
        update: { ...donnees, configuree: true, ...(cheminLogo ? { logo: cheminLogo } : {}) },
        create: { id: 1, ...donnees, configuree: true, ...(cheminLogo ? { logo: cheminLogo } : {}) }
      })

      await journaliser('PARAMETRES', {
        utilisateurId: auteurId,
        details: `Informations de l'école mises à jour (${donnees.nom})`
      })
      return { ok: true, data: null }
    }
  )

  // ------------------------------------------------------- années scolaires
  ipcMain.handle(
    IPC.parametres.anneeCreate,
    async (_e, input: unknown, auteurId: number): Promise<OperationResult<{ id: number }>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const parsed = anneeScolaireInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Libellé invalide.' }
      }
      const prisma = getPrisma()

      const existante = await prisma.anneeScolaire.findUnique({
        where: { libelle: parsed.data.libelle }
      })
      if (existante) return { ok: false, erreur: 'Cette année scolaire existe déjà.' }

      const annee = await prisma.anneeScolaire.create({
        data: { libelle: parsed.data.libelle, active: false }
      })

      await journaliser('PARAMETRES', {
        utilisateurId: auteurId,
        details: `Création de l'année scolaire ${annee.libelle}`
      })
      return { ok: true, data: { id: annee.id } }
    }
  )

  ipcMain.handle(
    IPC.parametres.anneeActiver,
    async (_e, id: number, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const anneeId = idSchema.parse(id)
      const prisma = getPrisma()

      const annee = await prisma.anneeScolaire.findUnique({ where: { id: anneeId } })
      if (!annee) return { ok: false, erreur: 'Année scolaire introuvable.' }

      // Une seule année active à la fois : transaction pour la bascule.
      await prisma.$transaction([
        prisma.anneeScolaire.updateMany({ data: { active: false } }),
        prisma.anneeScolaire.update({ where: { id: anneeId }, data: { active: true } })
      ])

      await journaliser('PARAMETRES', {
        utilisateurId: auteurId,
        details: `Activation de l'année scolaire ${annee.libelle}`
      })
      return { ok: true, data: null }
    }
  )

  // ---------------------------------------------------------------- classes
  ipcMain.handle(IPC.parametres.classesList, async (): Promise<ClasseDetail[]> => {
    const classes = await getPrisma().classe.findMany({
      orderBy: { ordre: 'asc' },
      include: { _count: { select: { inscriptions: true } } }
    })
    return classes.map((c) => ({
      id: c.id,
      nom: c.nom,
      niveau: niveauSchema.catch('PRIMAIRE').parse(c.niveau),
      ordre: c.ordre,
      nbInscriptions: c._count.inscriptions
    }))
  })

  ipcMain.handle(
    IPC.parametres.classeCreate,
    async (_e, input: unknown, auteurId: number): Promise<OperationResult<{ id: number }>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const parsed = classeInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const prisma = getPrisma()

      const existante = await prisma.classe.findUnique({ where: { nom: parsed.data.nom } })
      if (existante) return { ok: false, erreur: 'Une classe porte déjà ce nom.' }

      const classe = await prisma.classe.create({ data: parsed.data })
      await journaliser('PARAMETRES', {
        utilisateurId: auteurId,
        details: `Création de la classe ${classe.nom}`
      })
      return { ok: true, data: { id: classe.id } }
    }
  )

  ipcMain.handle(
    IPC.parametres.classeUpdate,
    async (_e, id: number, input: unknown, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const parsed = classeInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const classeId = idSchema.parse(id)
      const prisma = getPrisma()

      const classe = await prisma.classe.findUnique({ where: { id: classeId } })
      if (!classe) return { ok: false, erreur: 'Classe introuvable.' }

      const homonyme = await prisma.classe.findUnique({ where: { nom: parsed.data.nom } })
      if (homonyme && homonyme.id !== classeId) {
        return { ok: false, erreur: 'Une classe porte déjà ce nom.' }
      }

      await prisma.classe.update({ where: { id: classeId }, data: parsed.data })
      await journaliser('PARAMETRES', {
        utilisateurId: auteurId,
        details: `Modification de la classe ${classe.nom} → ${parsed.data.nom}`
      })
      return { ok: true, data: null }
    }
  )

  ipcMain.handle(
    IPC.parametres.classeDelete,
    async (_e, id: number, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const classeId = idSchema.parse(id)
      const prisma = getPrisma()

      const classe = await prisma.classe.findUnique({
        where: { id: classeId },
        include: { _count: { select: { inscriptions: true } } }
      })
      if (!classe) return { ok: false, erreur: 'Classe introuvable.' }
      if (classe._count.inscriptions > 0) {
        return {
          ok: false,
          erreur: 'Cette classe a des inscriptions : elle ne peut pas être supprimée.'
        }
      }

      await prisma.classe.delete({ where: { id: classeId } })
      await journaliser('PARAMETRES', {
        utilisateurId: auteurId,
        details: `Suppression de la classe ${classe.nom}`
      })
      return { ok: true, data: null }
    }
  )
}
