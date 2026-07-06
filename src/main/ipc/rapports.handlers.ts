/**
 * Handlers IPC du module Rapports : aperçu des données et export PDF/Excel.
 * L'export écrit le fichier dans le dossier « rapports », l'ouvre avec
 * l'application par défaut et trace l'action au journal.
 */
import { ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { genererRapport } from '../services/rapports'
import { genererRapportPdf } from '../services/rapportPdf'
import { genererRapportExcel } from '../services/rapportExcel'
import { getRapportsDir } from '../services/dossiers'
import { IPC } from '@shared/ipc'
import {
  rapportParamsSchema,
  TYPE_RAPPORT_LABELS,
  type FormatExport,
  type OperationResult,
  type RapportData
} from '@shared/types'

const formatSchema = z.enum(['pdf', 'excel'])
const auteurSchema = z.number().int().positive()

export function registerRapportsHandlers(): void {
  // Aperçu : données du rapport pour affichage dans l'interface.
  ipcMain.handle(
    IPC.rapports.generer,
    async (_e, params: unknown): Promise<OperationResult<RapportData>> => {
      const parsed = rapportParamsSchema.safeParse(params)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Paramètres invalides.' }
      }
      try {
        return { ok: true, data: await genererRapport(getPrisma(), parsed.data) }
      } catch (e) {
        return { ok: false, erreur: e instanceof Error ? e.message : 'Erreur lors de la génération.' }
      }
    }
  )

  // Export : fichier PDF ou Excel écrit sur disque puis ouvert.
  ipcMain.handle(
    IPC.rapports.exporter,
    async (
      _e,
      params: unknown,
      format: FormatExport,
      auteurId: number
    ): Promise<OperationResult<{ chemin: string }>> => {
      const parsed = rapportParamsSchema.safeParse(params)
      if (!parsed.success) {
        return { ok: false, erreur: parsed.error.issues[0]?.message ?? 'Paramètres invalides.' }
      }
      const formatFichier = formatSchema.parse(format)
      const auteur = auteurSchema.parse(auteurId)
      const prisma = getPrisma()

      try {
        const data = await genererRapport(prisma, parsed.data)

        const dossier = getRapportsDir()
        fs.mkdirSync(dossier, { recursive: true })
        const horodatage = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
        const extension = formatFichier === 'pdf' ? 'pdf' : 'xlsx'
        const chemin = path.join(
          dossier,
          `rapport-${data.type.toLowerCase()}-${horodatage}.${extension}`
        )

        if (formatFichier === 'pdf') {
          await genererRapportPdf(prisma, data, chemin)
        } else {
          await genererRapportExcel(prisma, data, chemin)
        }

        const erreurOuverture = await shell.openPath(chemin)
        if (erreurOuverture) {
          return { ok: false, erreur: `Rapport créé mais impossible de l'ouvrir : ${erreurOuverture}` }
        }

        await journaliser('EXPORT_RAPPORT', {
          utilisateurId: auteur,
          details: `${TYPE_RAPPORT_LABELS[data.type]} (${formatFichier.toUpperCase()}) : ${data.sousTitre}`
        })
        return { ok: true, data: { chemin } }
      } catch (e) {
        return { ok: false, erreur: e instanceof Error ? e.message : "Erreur lors de l'export." }
      }
    }
  )
}
