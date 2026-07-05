/**
 * Handlers IPC du module Paiements.
 * Règles : montant strictement positif, plafonné au reste à payer ;
 * numéro de reçu généré en transaction ; caissier = utilisateur connecté ;
 * suppression réservée à l'Administrateur (correction d'erreur de saisie).
 */
import { ipcMain } from 'electron'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { genererNumeroRecu } from '../services/numeroRecu'
import { IPC } from '@shared/ipc'
import {
  modePaiementSchema,
  paiementInputSchema,
  type HistoriquePaiements,
  type OperationResult,
  type Paginated,
  type PaiementListItem,
  type PaiementListParams
} from '@shared/types'

const listParamsSchema = z.object({
  recherche: z.string().default(''),
  mode: modePaiementSchema.optional(),
  anneeScolaireId: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
  parPage: z.number().int().min(1).max(100).default(15)
})

const auteurSchema = z.number().int().positive()

export function registerPaiementsHandlers(): void {
  // ------------------------------------------------------------------ liste
  ipcMain.handle(
    IPC.paiements.list,
    async (_e, params: PaiementListParams): Promise<Paginated<PaiementListItem>> => {
      const { recherche, mode, anneeScolaireId, page, parPage } = listParamsSchema.parse(params)
      const prisma = getPrisma()

      const where = {
        ...(mode ? { mode } : {}),
        inscription: {
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
      }

      const [total, paiements] = await Promise.all([
        prisma.paiement.count({ where }),
        prisma.paiement.findMany({
          where,
          orderBy: { datePaiement: 'desc' },
          skip: (page - 1) * parPage,
          take: parPage,
          include: {
            caissier: { select: { nom: true } },
            inscription: {
              include: {
                eleve: { select: { matricule: true, nom: true, prenom: true } },
                classe: { select: { nom: true } },
                anneeScolaire: { select: { libelle: true } }
              }
            }
          }
        })
      ])

      return {
        items: paiements.map((p) => ({
          id: p.id,
          numeroRecu: p.numeroRecu,
          inscriptionId: p.inscriptionId,
          matricule: p.inscription.eleve.matricule,
          nomComplet: `${p.inscription.eleve.nom} ${p.inscription.eleve.prenom}`,
          classe: p.inscription.classe.nom,
          anneeScolaire: p.inscription.anneeScolaire.libelle,
          montant: p.montant,
          mode: modePaiementSchema.catch('ESPECES').parse(p.mode),
          caissier: p.caissier.nom,
          datePaiement: p.datePaiement.toISOString()
        })),
        total,
        page,
        parPage
      }
    }
  )

  // ----------------------------------------------------------- encaissement
  ipcMain.handle(
    IPC.paiements.create,
    async (
      _e,
      input: unknown,
      auteurId: number
    ): Promise<OperationResult<{ id: number; numeroRecu: string; reste: number }>> => {
      const parsed = paiementInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Données invalides.' }
      }
      const auteur = auteurSchema.parse(auteurId)
      const donnees = parsed.data
      const prisma = getPrisma()

      // Transaction : contrôle du reste + génération du numéro de reçu +
      // création, atomiques pour éviter tout dépassement ou doublon.
      const resultat = await prisma.$transaction(
        async (
          tx
        ): Promise<
          { ok: true; id: number; numeroRecu: string; reste: number } | { ok: false; erreur: string }
        > => {
          const inscription = await tx.inscription.findUnique({
            where: { id: donnees.inscriptionId },
            include: {
              paiements: { select: { montant: true } },
              eleve: { select: { matricule: true, nom: true, prenom: true } },
              anneeScolaire: { select: { libelle: true } }
            }
          })
          if (!inscription) return { ok: false, erreur: 'Inscription introuvable.' }

          const montantPaye = inscription.paiements.reduce((somme, p) => somme + p.montant, 0)
          const reste = inscription.montantTotal - montantPaye
          if (reste <= 0) {
            return { ok: false, erreur: 'Cette inscription est déjà entièrement soldée.' }
          }
          if (donnees.montant > reste) {
            return {
              ok: false,
              erreur: `Le montant dépasse le reste à payer (${reste.toLocaleString('fr-FR')} FCFA).`
            }
          }

          const numeroRecu = await genererNumeroRecu(tx, inscription.anneeScolaire.libelle)
          const paiement = await tx.paiement.create({
            data: {
              inscriptionId: donnees.inscriptionId,
              montant: donnees.montant,
              mode: donnees.mode,
              numeroRecu,
              caissierId: auteur
            }
          })

          return { ok: true, id: paiement.id, numeroRecu, reste: reste - donnees.montant }
        }
      )

      if (!resultat.ok) return resultat

      const inscription = await prisma.inscription.findUnique({
        where: { id: donnees.inscriptionId },
        include: { eleve: { select: { matricule: true, nom: true, prenom: true } } }
      })
      await journaliser('PAIEMENT', {
        utilisateurId: auteur,
        details: `${resultat.numeroRecu} — ${inscription?.eleve.matricule} ${inscription?.eleve.nom} ${inscription?.eleve.prenom}, ${donnees.montant} FCFA (${donnees.mode})`
      })
      return {
        ok: true,
        data: { id: resultat.id, numeroRecu: resultat.numeroRecu, reste: resultat.reste }
      }
    }
  )

  // ------------------------------------------------------------- historique
  ipcMain.handle(
    IPC.paiements.historique,
    async (_e, inscriptionId: number): Promise<OperationResult<HistoriquePaiements>> => {
      const prisma = getPrisma()
      const inscription = await prisma.inscription.findUnique({
        where: { id: z.number().int().parse(inscriptionId) },
        include: {
          eleve: { select: { matricule: true, nom: true, prenom: true } },
          classe: { select: { nom: true } },
          anneeScolaire: { select: { libelle: true } },
          paiements: {
            orderBy: { datePaiement: 'asc' },
            include: { caissier: { select: { nom: true } } }
          }
        }
      })
      if (!inscription) return { ok: false, erreur: 'Inscription introuvable.' }

      const montantPaye = inscription.paiements.reduce((somme, p) => somme + p.montant, 0)
      return {
        ok: true,
        data: {
          inscriptionId: inscription.id,
          matricule: inscription.eleve.matricule,
          nomComplet: `${inscription.eleve.nom} ${inscription.eleve.prenom}`,
          classe: inscription.classe.nom,
          anneeScolaire: inscription.anneeScolaire.libelle,
          montantTotal: inscription.montantTotal,
          montantPaye,
          reste: inscription.montantTotal - montantPaye,
          versements: inscription.paiements.map((p) => ({
            id: p.id,
            numeroRecu: p.numeroRecu,
            montant: p.montant,
            mode: modePaiementSchema.catch('ESPECES').parse(p.mode),
            caissier: p.caissier.nom,
            datePaiement: p.datePaiement.toISOString()
          }))
        }
      }
    }
  )

  // ------------------------------------------------------------ suppression
  ipcMain.handle(
    IPC.paiements.delete,
    async (_e, id: number, auteurId: number): Promise<OperationResult<null>> => {
      const auteur = auteurSchema.parse(auteurId)
      const paiementId = z.number().int().parse(id)
      const prisma = getPrisma()

      // Seul l'Administrateur peut annuler un paiement (erreur de saisie).
      const utilisateur = await prisma.utilisateur.findUnique({ where: { id: auteur } })
      if (!utilisateur || utilisateur.role !== 'ADMINISTRATEUR') {
        return { ok: false, erreur: 'Seul un administrateur peut annuler un paiement.' }
      }

      const paiement = await prisma.paiement.findUnique({
        where: { id: paiementId },
        include: {
          inscription: { include: { eleve: { select: { matricule: true, nom: true, prenom: true } } } }
        }
      })
      if (!paiement) return { ok: false, erreur: 'Paiement introuvable.' }

      await prisma.paiement.delete({ where: { id: paiementId } })

      await journaliser('PAIEMENT', {
        utilisateurId: auteur,
        details: `Annulation ${paiement.numeroRecu} — ${paiement.inscription.eleve.matricule} ${paiement.inscription.eleve.nom} ${paiement.inscription.eleve.prenom}, ${paiement.montant} FCFA`
      })
      return { ok: true, data: null }
    }
  )
}
