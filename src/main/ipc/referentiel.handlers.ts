/**
 * Handlers IPC du référentiel : classes et années scolaires,
 * utilisés par les listes déroulantes des formulaires.
 */
import { ipcMain } from 'electron'
import { getPrisma } from '../database/client'
import { IPC } from '@shared/ipc'
import { niveauSchema, type AnneeScolaireRef, type ClasseRef } from '@shared/types'

export function registerReferentielHandlers(): void {
  ipcMain.handle(IPC.referentiel.classes, async (): Promise<ClasseRef[]> => {
    const classes = await getPrisma().classe.findMany({ orderBy: { ordre: 'asc' } })
    return classes.map((c) => ({
      id: c.id,
      nom: c.nom,
      niveau: niveauSchema.catch('PRIMAIRE').parse(c.niveau)
    }))
  })

  ipcMain.handle(IPC.referentiel.annees, async (): Promise<AnneeScolaireRef[]> => {
    const annees = await getPrisma().anneeScolaire.findMany({ orderBy: { libelle: 'desc' } })
    return annees.map((a) => ({ id: a.id, libelle: a.libelle, active: a.active }))
  })
}
