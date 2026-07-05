/**
 * Handlers IPC du Journal d'activité — consultation réservée à
 * l'Administrateur et au Directeur (vérifié en base à chaque appel).
 * L'écriture du journal se fait via services/journal.ts depuis chaque module.
 */
import { ipcMain } from 'electron'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { IPC } from '@shared/ipc'
import {
  ACTIONS_JOURNAL,
  type JournalListItem,
  type JournalParams,
  type OperationResult,
  type Paginated,
  type UtilisateurRef
} from '@shared/types'

const paramsSchema = z.object({
  action: z.enum(ACTIONS_JOURNAL).optional(),
  utilisateurId: z.number().int().positive().optional(),
  du: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  au: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  parPage: z.number().int().min(1).max(100).default(20)
})

/** Vérifie que l'appelant est un administrateur ou un directeur actif. */
async function verifierLecteur(
  auteurId: number
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const auteur = await getPrisma().utilisateur.findUnique({
    where: { id: z.number().int().positive().parse(auteurId) }
  })
  if (!auteur || !auteur.actif || (auteur.role !== 'ADMINISTRATEUR' && auteur.role !== 'DIRECTEUR')) {
    return { ok: false, erreur: 'Le journal est réservé à l’administrateur et au directeur.' }
  }
  return { ok: true }
}

export function registerJournalHandlers(): void {
  ipcMain.handle(
    IPC.journal.list,
    async (
      _e,
      params: JournalParams,
      auteurId: number
    ): Promise<OperationResult<Paginated<JournalListItem>>> => {
      const lecteur = await verifierLecteur(auteurId)
      if (!lecteur.ok) return lecteur

      const { action, utilisateurId, du, au, page, parPage } = paramsSchema.parse(params)
      const prisma = getPrisma()

      // Bornes de période : `au` est inclus (borne haute exclusive au jour+1).
      let dateFiltre: { gte?: Date; lt?: Date } | undefined
      if (du || au) {
        dateFiltre = {}
        if (du) dateFiltre.gte = new Date(`${du}T00:00:00`)
        if (au) {
          const fin = new Date(`${au}T00:00:00`)
          fin.setDate(fin.getDate() + 1)
          dateFiltre.lt = fin
        }
      }

      const where = {
        ...(action ? { action } : {}),
        ...(utilisateurId ? { utilisateurId } : {}),
        ...(dateFiltre ? { date: dateFiltre } : {})
      }

      const [total, entrees] = await Promise.all([
        prisma.journalActivite.count({ where }),
        prisma.journalActivite.findMany({
          where,
          orderBy: { date: 'desc' }, // les plus récentes en premier
          skip: (page - 1) * parPage,
          take: parPage,
          include: { utilisateur: { select: { nom: true } } }
        })
      ])

      return {
        ok: true,
        data: {
          items: entrees.map((e) => ({
            id: e.id,
            date: e.date.toISOString(),
            utilisateur: e.utilisateur?.nom ?? null,
            action: z.enum(ACTIONS_JOURNAL).catch('CONNEXION').parse(e.action),
            details: e.details,
            poste: e.poste
          })),
          total,
          page,
          parPage
        }
      }
    }
  )

  // Référence des utilisateurs (id + nom) pour le filtre du journal.
  ipcMain.handle(
    IPC.journal.utilisateurs,
    async (_e, auteurId: number): Promise<OperationResult<UtilisateurRef[]>> => {
      const lecteur = await verifierLecteur(auteurId)
      if (!lecteur.ok) return lecteur

      const utilisateurs = await getPrisma().utilisateur.findMany({
        orderBy: { nom: 'asc' },
        select: { id: true, nom: true }
      })
      return { ok: true, data: utilisateurs }
    }
  )
}
