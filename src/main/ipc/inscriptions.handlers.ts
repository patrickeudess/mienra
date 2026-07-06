/**
 * Handlers IPC du module Inscriptions.
 * Le montant total est TOUJOURS calculé côté main
 * (scolarité + frais d'inscription + autres frais).
 */
import { ipcMain } from 'electron'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { IPC } from '@shared/ipc'
import {
  inscriptionInputSchema,
  inscriptionUpdateSchema,
  type InscriptionListItem,
  type InscriptionListParams,
  type OperationResult,
  type Paginated
} from '@shared/types'

const listParamsSchema = z.object({
  recherche: z.string().default(''),
  classeId: z.number().int().positive().optional(),
  anneeScolaireId: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
  parPage: z.number().int().min(1).max(100).default(15)
})

const auteurSchema = z.number().int().positive()

export function registerInscriptionsHandlers(): void {
  // ------------------------------------------------------------------ liste
  ipcMain.handle(
    IPC.inscriptions.list,
    async (_e, params: InscriptionListParams): Promise<Paginated<InscriptionListItem>> => {
      const { recherche, classeId, anneeScolaireId, page, parPage } = listParamsSchema.parse(params)
      const prisma = getPrisma()

      const where = {
        ...(classeId ? { classeId } : {}),
        ...(anneeScolaireId ? { anneeScolaireId } : {}),
        ...(recherche
          ? {
              eleve: {
                OR: [
                  { matricule: { contains: recherche } },
                  { nom: { contains: recherche } },
                  { prenom: { contains: recherche } }
                ]
              }
            }
          : {})
      }

      const [total, inscriptions] = await Promise.all([
        prisma.inscription.count({ where }),
        prisma.inscription.findMany({
          where,
          orderBy: { dateInscription: 'desc' },
          skip: (page - 1) * parPage,
          take: parPage,
          include: {
            eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
            classe: { select: { nom: true } },
            anneeScolaire: { select: { libelle: true } },
            paiements: { select: { montant: true } }
          }
        })
      ])

      return {
        items: inscriptions.map((i) => {
          const montantPaye = i.paiements.reduce((somme, p) => somme + p.montant, 0)
          return {
            id: i.id,
            eleveId: i.eleve.id,
            matricule: i.eleve.matricule,
            nomComplet: `${i.eleve.nom} ${i.eleve.prenom}`,
            classe: i.classe.nom,
            anneeScolaire: i.anneeScolaire.libelle,
            scolarite: i.scolarite,
            fraisInscription: i.fraisInscription,
            autresFrais: i.autresFrais,
            montantTotal: i.montantTotal,
            montantPaye,
            reste: i.montantTotal - montantPaye,
            dateInscription: i.dateInscription.toISOString()
          }
        }),
        total,
        page,
        parPage
      }
    }
  )

  // --------------------------------------------------------------- création
  ipcMain.handle(
    IPC.inscriptions.create,
    async (_e, input: unknown, auteurId: number): Promise<OperationResult<{ id: number }>> => {
      const parsed = inscriptionInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const auteur = auteurSchema.parse(auteurId)
      const donnees = parsed.data
      const prisma = getPrisma()

      // Un élève ne peut être inscrit qu'une fois par année scolaire.
      const existante = await prisma.inscription.findUnique({
        where: {
          eleveId_anneeScolaireId: {
            eleveId: donnees.eleveId,
            anneeScolaireId: donnees.anneeScolaireId
          }
        },
        include: { anneeScolaire: { select: { libelle: true } } }
      })
      if (existante) {
        return {
          ok: false,
          erreur: `Cet élève est déjà inscrit pour l'année ${existante.anneeScolaire.libelle}.`
        }
      }

      const inscription = await prisma.inscription.create({
        data: {
          ...donnees,
          montantTotal: donnees.scolarite + donnees.fraisInscription + donnees.autresFrais
        },
        include: {
          eleve: { select: { matricule: true, nom: true, prenom: true } },
          classe: { select: { nom: true } },
          anneeScolaire: { select: { libelle: true } }
        }
      })

      await journaliser('INSCRIPTION', {
        utilisateurId: auteur,
        details: `${inscription.eleve.matricule} : ${inscription.eleve.nom} ${inscription.eleve.prenom} en ${inscription.classe.nom} (${inscription.anneeScolaire.libelle}), total ${inscription.montantTotal} FCFA`
      })
      return { ok: true, data: { id: inscription.id } }
    }
  )

  // ----------------------------------------------------------- modification
  ipcMain.handle(
    IPC.inscriptions.update,
    async (_e, id: number, input: unknown, auteurId: number): Promise<OperationResult<{ id: number }>> => {
      const parsed = inscriptionUpdateSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const auteur = auteurSchema.parse(auteurId)
      const inscriptionId = z.number().int().parse(id)
      const donnees = parsed.data
      const prisma = getPrisma()

      const existante = await prisma.inscription.findUnique({
        where: { id: inscriptionId },
        include: {
          paiements: { select: { montant: true } },
          eleve: { select: { matricule: true, nom: true, prenom: true } }
        }
      })
      if (!existante) return { ok: false, erreur: 'Inscription introuvable.' }

      // Le nouveau total ne peut pas être inférieur à ce qui a déjà été payé.
      const montantPaye = existante.paiements.reduce((somme, p) => somme + p.montant, 0)
      const nouveauTotal = donnees.scolarite + donnees.fraisInscription + donnees.autresFrais
      if (nouveauTotal < montantPaye) {
        return {
          ok: false,
          erreur: `Impossible : ${montantPaye} FCFA ont déjà été payés, le nouveau total (${nouveauTotal} FCFA) est inférieur.`
        }
      }

      await prisma.inscription.update({
        where: { id: inscriptionId },
        data: { ...donnees, montantTotal: nouveauTotal }
      })

      await journaliser('INSCRIPTION', {
        utilisateurId: auteur,
        details: `Modification : ${existante.eleve.matricule} ${existante.eleve.nom} ${existante.eleve.prenom}, nouveau total ${nouveauTotal} FCFA`
      })
      return { ok: true, data: { id: inscriptionId } }
    }
  )

  // ------------------------------------------------------------ suppression
  ipcMain.handle(
    IPC.inscriptions.delete,
    async (_e, id: number, auteurId: number): Promise<OperationResult<null>> => {
      const auteur = auteurSchema.parse(auteurId)
      const inscriptionId = z.number().int().parse(id)
      const prisma = getPrisma()

      const inscription = await prisma.inscription.findUnique({
        where: { id: inscriptionId },
        include: {
          _count: { select: { paiements: true } },
          eleve: { select: { matricule: true, nom: true, prenom: true } }
        }
      })
      if (!inscription) return { ok: false, erreur: 'Inscription introuvable.' }

      // Intégrité : pas de suppression si des paiements existent.
      if (inscription._count.paiements > 0) {
        return {
          ok: false,
          erreur:
            'Cette inscription a des paiements enregistrés : elle ne peut pas être supprimée afin de préserver l’historique financier.'
        }
      }

      await prisma.inscription.delete({ where: { id: inscriptionId } })

      await journaliser('INSCRIPTION', {
        utilisateurId: auteur,
        details: `Suppression : ${inscription.eleve.matricule} ${inscription.eleve.nom} ${inscription.eleve.prenom}`
      })
      return { ok: true, data: null }
    }
  )
}
