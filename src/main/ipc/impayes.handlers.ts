/**
 * Handlers IPC du module Impayés : inscriptions dont le montant payé est
 * inférieur au montant total, avec filtres par classe, niveau et année
 * scolaire, et totaux sur l'ensemble des lignes filtrées.
 * L'agrégation est partagée avec les rapports (services/impayes.ts).
 */
import { ipcMain } from 'electron'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { calculerImpayes } from '../services/impayes'
import { IPC } from '@shared/ipc'
import { niveauSchema, type ImpayesParams, type ImpayesResult } from '@shared/types'

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

    const impayes = await calculerImpayes(getPrisma(), {
      recherche,
      classeId,
      niveau,
      anneeScolaireId
    })
    const totaux = impayes.reduce(
      (t, i) => ({
        montantAttendu: t.montantAttendu + i.montantAttendu,
        montantPaye: t.montantPaye + i.montantPaye,
        reste: t.reste + i.reste
      }),
      { montantAttendu: 0, montantPaye: 0, reste: 0 }
    )

    return {
      items: impayes.slice((page - 1) * parPage, page * parPage),
      total: impayes.length,
      page,
      parPage,
      totaux
    }
  })
}
