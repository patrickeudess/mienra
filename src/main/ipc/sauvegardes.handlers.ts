/**
 * Handlers IPC du module Sauvegardes — réservé à l'Administrateur.
 * - liste des sauvegardes automatiques et manuelles ;
 * - sauvegarde manuelle immédiate ;
 * - restauration (filet de sécurité créé avant, application relancée après) ;
 * - export de la base vers un emplacement choisi par l'utilisateur.
 */
import { app, dialog, ipcMain } from 'electron'
import fs from 'fs'
import { z } from 'zod'
import {
  createBackup,
  listerSauvegardes,
  resoudreSauvegarde,
  restaurerSauvegarde
} from '../database/backup'
import { disconnectPrisma, getDatabasePath, getPrisma } from '../database/client'
import { journaliser } from '../services/journal'
import { verifierAdmin } from '../services/utilisateursGuards'
import { IPC } from '@shared/ipc'
import type { OperationResult, SauvegardeInfo } from '@shared/types'

const idSchema = z.number().int().positive()

async function verifier(auteurId: number): Promise<{ ok: true } | { ok: false; erreur: string }> {
  return verifierAdmin(getPrisma(), idSchema.parse(auteurId))
}

export function registerSauvegardesHandlers(): void {
  // ------------------------------------------------------------------ liste
  ipcMain.handle(
    IPC.sauvegardes.list,
    async (_e, auteurId: number): Promise<OperationResult<SauvegardeInfo[]>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin
      return {
        ok: true,
        data: listerSauvegardes().map((s) => ({
          nom: s.nom,
          date: s.date.toISOString(),
          taille: s.taille
        }))
      }
    }
  )

  // -------------------------------------------------- sauvegarde manuelle
  ipcMain.handle(
    IPC.sauvegardes.creer,
    async (_e, auteurId: number): Promise<OperationResult<{ nom: string }>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const chemin = createBackup()
      if (!chemin) return { ok: false, erreur: 'La base de données est introuvable.' }

      const nom = chemin.split(/[\\/]/).pop() ?? chemin
      await journaliser('SAUVEGARDE', { utilisateurId: auteurId, details: `Manuelle — ${nom}` })
      return { ok: true, data: { nom } }
    }
  )

  // ----------------------------------------------------------- restauration
  ipcMain.handle(
    IPC.sauvegardes.restaurer,
    async (_e, nom: string, auteurId: number): Promise<OperationResult<null>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const chemin = resoudreSauvegarde(z.string().parse(nom))
      if (!chemin) return { ok: false, erreur: 'Sauvegarde introuvable ou nom invalide.' }

      // Ferme la connexion, remplace le fichier (un filet de sécurité de la
      // base actuelle est créé d'abord), puis journalise dans la base
      // RESTAURÉE avant de relancer l'application.
      await disconnectPrisma()
      restaurerSauvegarde(chemin)
      await journaliser('RESTAURATION', {
        utilisateurId: auteurId,
        details: `Restauration de ${nom}`
      })
      await disconnectPrisma()

      // Redémarrage : toutes les vues repartent sur la base restaurée.
      app.relaunch()
      app.exit(0)
      return { ok: true, data: null }
    }
  )

  // ---------------------------------------------------- export de la base
  ipcMain.handle(
    IPC.sauvegardes.exporter,
    async (_e, auteurId: number): Promise<OperationResult<{ chemin: string } | null>> => {
      const admin = await verifier(auteurId)
      if (!admin.ok) return admin

      const dbPath = getDatabasePath()
      if (!fs.existsSync(dbPath)) {
        return { ok: false, erreur: 'La base de données est introuvable.' }
      }

      const horodatage = new Date().toISOString().slice(0, 10)
      const choix = await dialog.showSaveDialog({
        title: 'Exporter la base de données',
        defaultPath: `mienra-export-${horodatage}.db`,
        filters: [{ name: 'Base de données SQLite', extensions: ['db'] }]
      })
      if (choix.canceled || !choix.filePath) return { ok: true, data: null } // annulé

      fs.copyFileSync(dbPath, choix.filePath)
      await journaliser('SAUVEGARDE', {
        utilisateurId: auteurId,
        details: `Export de la base vers ${choix.filePath}`
      })
      return { ok: true, data: { chemin: choix.filePath } }
    }
  )
}
