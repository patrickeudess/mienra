/**
 * Handlers IPC du module Reçus.
 * Le reçu PDF est généré automatiquement à l'encaissement (voir
 * paiements.handlers) ; ici : réimpression en un clic (ouverture du PDF,
 * régénéré si absent) et accès au dossier des reçus.
 */
import { ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { genererRecuPdf } from '../services/recuPdf'
import { getRecusDir } from '../services/dossiers'
import { IPC } from '@shared/ipc'
import type { OperationResult } from '@shared/types'

const auteurSchema = z.number().int().positive()

export function registerRecusHandlers(): void {
  // Impression en un clic : génère le PDF si nécessaire puis l'ouvre avec
  // le lecteur PDF du système (d'où l'utilisateur imprime).
  ipcMain.handle(
    IPC.recus.imprimer,
    async (_e, paiementId: number, auteurId: number): Promise<OperationResult<{ chemin: string }>> => {
      const auteur = auteurSchema.parse(auteurId)
      const id = z.number().int().parse(paiementId)
      const prisma = getPrisma()

      const paiement = await prisma.paiement.findUnique({
        where: { id },
        include: { inscription: { include: { eleve: { select: { matricule: true } } } } }
      })
      if (!paiement) return { ok: false, erreur: 'Paiement introuvable.' }

      let chemin = path.join(getRecusDir(), `${paiement.numeroRecu}.pdf`)
      if (!fs.existsSync(chemin)) {
        chemin = await genererRecuPdf(prisma, id, getRecusDir())
      }

      const erreurOuverture = await shell.openPath(chemin)
      if (erreurOuverture) {
        return { ok: false, erreur: `Impossible d'ouvrir le reçu : ${erreurOuverture}` }
      }

      await journaliser('IMPRESSION_RECU', {
        utilisateurId: auteur,
        details: `${paiement.numeroRecu} : ${paiement.inscription.eleve.matricule}`
      })
      return { ok: true, data: { chemin } }
    }
  )

  // Ouvre le dossier contenant tous les reçus générés.
  ipcMain.handle(IPC.recus.ouvrirDossier, async (): Promise<void> => {
    const dossier = getRecusDir()
    fs.mkdirSync(dossier, { recursive: true })
    await shell.openPath(dossier)
  })
}
