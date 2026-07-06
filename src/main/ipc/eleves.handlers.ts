/**
 * Handlers IPC du module Élèves : liste paginée avec recherche, fiche
 * détaillée, création (matricule automatique), modification et suppression.
 * Chaque écriture est tracée au journal d'activité.
 */
import { ipcMain } from 'electron'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { genererMatricule } from '../services/matricule'
import { enregistrerPhoto, lirePhotoDataUrl, supprimerPhoto } from '../services/photos'
import { IPC } from '@shared/ipc'
import {
  eleveInputSchema,
  sexeSchema,
  type EleveDetail,
  type EleveListItem,
  type EleveListParams,
  type OperationResult,
  type Paginated
} from '@shared/types'

/** Paramètres de liste, validés côté main. */
const listParamsSchema = z.object({
  recherche: z.string().default(''),
  page: z.number().int().min(1).default(1),
  parPage: z.number().int().min(1).max(100).default(15)
})

/** Identifiant de l'utilisateur à l'origine de l'action (pour le journal). */
const auteurSchema = z.number().int().positive()

export function registerElevesHandlers(): void {
  // ------------------------------------------------------------------ liste
  ipcMain.handle(
    IPC.eleves.list,
    async (_e, params: EleveListParams): Promise<Paginated<EleveListItem>> => {
      const { recherche, page, parPage } = listParamsSchema.parse(params)
      const prisma = getPrisma()

      // Recherche sur matricule, nom ou prénom (LIKE, insensible à la casse
      // pour les caractères ASCII avec SQLite).
      const where = recherche
        ? {
            OR: [
              { matricule: { contains: recherche } },
              { nom: { contains: recherche } },
              { prenom: { contains: recherche } }
            ]
          }
        : {}

      const anneeActive = await prisma.anneeScolaire.findFirst({ where: { active: true } })
      const [total, eleves] = await Promise.all([
        prisma.eleve.count({ where }),
        prisma.eleve.findMany({
          where,
          orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
          skip: (page - 1) * parPage,
          take: parPage,
          include: {
            inscriptions: {
              // Sans année active, aucun id ne vaut -1 : la liste reste vide.
              where: { anneeScolaireId: anneeActive?.id ?? -1 },
              include: { classe: { select: { nom: true } } }
            }
          }
        })
      ])

      return {
        items: eleves.map((e) => ({
          id: e.id,
          matricule: e.matricule,
          nom: e.nom,
          prenom: e.prenom,
          sexe: sexeSchema.catch('M').parse(e.sexe),
          dateNaissance: e.dateNaissance.toISOString(),
          telephoneParent: e.telephoneParent,
          classe: e.inscriptions[0]?.classe.nom ?? null
        })),
        total,
        page,
        parPage
      }
    }
  )

  // ------------------------------------------------------------------ fiche
  ipcMain.handle(
    IPC.eleves.get,
    async (_e, id: number): Promise<OperationResult<EleveDetail>> => {
      const prisma = getPrisma()
      const eleve = await prisma.eleve.findUnique({
        where: { id: z.number().int().parse(id) },
        include: {
          inscriptions: {
            orderBy: { dateInscription: 'desc' },
            include: {
              classe: { select: { nom: true } },
              anneeScolaire: { select: { libelle: true } },
              paiements: { select: { montant: true } }
            }
          }
        }
      })
      if (!eleve) return { ok: false, erreur: 'Élève introuvable.' }

      return {
        ok: true,
        data: {
          id: eleve.id,
          matricule: eleve.matricule,
          nom: eleve.nom,
          prenom: eleve.prenom,
          sexe: sexeSchema.catch('M').parse(eleve.sexe),
          dateNaissance: eleve.dateNaissance.toISOString(),
          lieuNaissance: eleve.lieuNaissance,
          nationalite: eleve.nationalite,
          telephoneParent: eleve.telephoneParent,
          nomParent: eleve.nomParent,
          adresse: eleve.adresse,
          photoDataUrl: lirePhotoDataUrl(eleve.photo),
          creeLe: eleve.creeLe.toISOString(),
          inscriptions: eleve.inscriptions.map((i) => ({
            id: i.id,
            classe: i.classe.nom,
            anneeScolaire: i.anneeScolaire.libelle,
            montantTotal: i.montantTotal,
            montantPaye: i.paiements.reduce((somme, p) => somme + p.montant, 0)
          }))
        }
      }
    }
  )

  // --------------------------------------------------------------- création
  ipcMain.handle(
    IPC.eleves.create,
    async (_e, input: unknown, auteurId: number): Promise<OperationResult<{ id: number; matricule: string }>> => {
      const parsed = eleveInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const auteur = auteurSchema.parse(auteurId)
      const { photo, ...donnees } = parsed.data
      const prisma = getPrisma()

      // Transaction : la génération du matricule et la création sont atomiques.
      const eleve = await prisma.$transaction(async (tx) => {
        const matricule = await genererMatricule(tx)
        return tx.eleve.create({
          data: {
            ...donnees,
            matricule,
            dateNaissance: new Date(donnees.dateNaissance)
          }
        })
      })

      // Photo écrite après la transaction (opération disque, non transactionnelle).
      if (photo) {
        const resultat = enregistrerPhoto(eleve.matricule, photo)
        if (resultat.ok) {
          await prisma.eleve.update({ where: { id: eleve.id }, data: { photo: resultat.chemin } })
        }
      }

      await journaliser('CREATION_ELEVE', {
        utilisateurId: auteur,
        details: `${eleve.matricule} : ${eleve.nom} ${eleve.prenom}`
      })
      return { ok: true, data: { id: eleve.id, matricule: eleve.matricule } }
    }
  )

  // ----------------------------------------------------------- modification
  ipcMain.handle(
    IPC.eleves.update,
    async (_e, id: number, input: unknown, auteurId: number): Promise<OperationResult<{ id: number }>> => {
      const parsed = eleveInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const auteur = auteurSchema.parse(auteurId)
      const eleveId = z.number().int().parse(id)
      const { photo, ...donnees } = parsed.data
      const prisma = getPrisma()

      const existant = await prisma.eleve.findUnique({ where: { id: eleveId } })
      if (!existant) return { ok: false, erreur: 'Élève introuvable.' }

      let cheminPhoto = existant.photo
      if (photo) {
        const resultat = enregistrerPhoto(existant.matricule, photo)
        if (!resultat.ok) return resultat
        cheminPhoto = resultat.chemin
      }

      await prisma.eleve.update({
        where: { id: eleveId },
        data: {
          ...donnees,
          dateNaissance: new Date(donnees.dateNaissance),
          photo: cheminPhoto
        }
      })

      await journaliser('MODIFICATION_ELEVE', {
        utilisateurId: auteur,
        details: `${existant.matricule} : ${donnees.nom} ${donnees.prenom}`
      })
      return { ok: true, data: { id: eleveId } }
    }
  )

  // ------------------------------------------------------------ suppression
  ipcMain.handle(
    IPC.eleves.delete,
    async (_e, id: number, auteurId: number): Promise<OperationResult<null>> => {
      const auteur = auteurSchema.parse(auteurId)
      const eleveId = z.number().int().parse(id)
      const prisma = getPrisma()

      const eleve = await prisma.eleve.findUnique({
        where: { id: eleveId },
        include: { _count: { select: { inscriptions: true } } }
      })
      if (!eleve) return { ok: false, erreur: 'Élève introuvable.' }

      // Intégrité : un élève avec des inscriptions (donc potentiellement des
      // paiements) ne peut pas être supprimé.
      if (eleve._count.inscriptions > 0) {
        return {
          ok: false,
          erreur:
            'Cet élève a des inscriptions enregistrées : il ne peut pas être supprimé afin de préserver l’historique financier.'
        }
      }

      await prisma.eleve.delete({ where: { id: eleveId } })
      supprimerPhoto(eleve.photo)

      await journaliser('SUPPRESSION_ELEVE', {
        utilisateurId: auteur,
        details: `${eleve.matricule} : ${eleve.nom} ${eleve.prenom}`
      })
      return { ok: true, data: null }
    }
  )
}
