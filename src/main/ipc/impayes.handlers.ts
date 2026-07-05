/**
 * Handlers IPC du module Impayés : inscriptions dont le montant payé est
 * inférieur au montant total, avec filtres par classe, niveau et année
 * scolaire, et totaux sur l'ensemble des lignes filtrées.
 *
 * Le filtre « reste > 0 » porte sur une somme de paiements : il ne peut pas
 * s'exprimer dans un `where` Prisma. Les inscriptions filtrées sont donc
 * chargées puis agrégées en mémoire — volumétrie d'un établissement
 * scolaire (quelques milliers de lignes au plus), sans enjeu de performance.
 */
import { ipcMain } from 'electron'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { IPC } from '@shared/ipc'
import { niveauSchema, type ImpayeListItem, type ImpayesParams, type ImpayesResult } from '@shared/types'

const paramsSchema = z.object({
  recherche: z.string().default(''),
  classeId: z.number().int().positive().optional(),
  niveau: niveauSchema.optional(),
  anneeScolaireId: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
  parPage: z.number().int().min(1).max(100).default(15)
})

export function registerImpayesHandlers(): void {
  ipcMain.handle(IPC.impayes.list, async (_e, params: ImpayesParams): Promise<ImpayesResult> => {
    const { recherche, classeId, niveau, anneeScolaireId, page, parPage } = paramsSchema.parse(params)
    const prisma = getPrisma()

    const inscriptions = await prisma.inscription.findMany({
      where: {
        ...(classeId ? { classeId } : {}),
        ...(niveau ? { classe: { niveau } } : {}),
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
      },
      include: {
        eleve: { select: { matricule: true, nom: true, prenom: true } },
        classe: { select: { nom: true, niveau: true } },
        anneeScolaire: { select: { libelle: true } },
        paiements: { select: { montant: true } }
      }
    })

    // Ne garder que les impayés, calculer le pourcentage et les totaux.
    const impayes: ImpayeListItem[] = []
    const totaux = { montantAttendu: 0, montantPaye: 0, reste: 0 }
    for (const i of inscriptions) {
      const paye = i.paiements.reduce((somme, p) => somme + p.montant, 0)
      const reste = i.montantTotal - paye
      if (reste <= 0) continue

      totaux.montantAttendu += i.montantTotal
      totaux.montantPaye += paye
      totaux.reste += reste
      impayes.push({
        inscriptionId: i.id,
        matricule: i.eleve.matricule,
        nomComplet: `${i.eleve.nom} ${i.eleve.prenom}`,
        classe: i.classe.nom,
        niveau: niveauSchema.catch('PRIMAIRE').parse(i.classe.niveau),
        anneeScolaire: i.anneeScolaire.libelle,
        montantAttendu: i.montantTotal,
        montantPaye: paye,
        reste,
        pourcentagePaye: i.montantTotal > 0 ? Math.floor((paye / i.montantTotal) * 100) : 0
      })
    }

    // Les plus gros restes en premier : ce sont les dossiers à relancer.
    impayes.sort((a, b) => b.reste - a.reste)

    return {
      items: impayes.slice((page - 1) * parPage, page * parPage),
      total: impayes.length,
      page,
      parPage,
      totaux
    }
  })
}
