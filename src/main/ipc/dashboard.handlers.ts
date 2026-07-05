/**
 * Handlers IPC du module Tableau de bord.
 * Toutes les statistiques sont calculées sur l'année scolaire active.
 */
import { ipcMain } from 'electron'
import { getPrisma } from '../database/client'
import { IPC } from '@shared/ipc'
import type { DashboardStats, EncaissementMensuel } from '@shared/types'

const MOIS_COURTS = [
  'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'
]

/** Clé "AAAA-MM" d'une date, en heure locale. */
function cleMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function registerDashboardHandlers(): void {
  ipcMain.handle(IPC.dashboard.stats, async (): Promise<DashboardStats> => {
    const prisma = getPrisma()

    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } })
    const statsVides: DashboardStats = {
      anneeScolaire: null,
      totalEleves: 0,
      totalInscriptions: 0,
      montantAttendu: 0,
      montantEncaisse: 0,
      soldeRestant: 0,
      elevesImpayes: 0,
      recettesDuJour: 0,
      encaissementsMensuels: []
    }
    if (!annee) return statsVides

    // Inscriptions de l'année active, avec leurs paiements.
    const inscriptions = await prisma.inscription.findMany({
      where: { anneeScolaireId: annee.id },
      include: { paiements: { select: { montant: true, datePaiement: true } } }
    })

    const totalEleves = await prisma.eleve.count()

    let montantAttendu = 0
    let montantEncaisse = 0
    let elevesImpayes = 0
    let recettesDuJour = 0

    // Graphique : les 12 mois de l'année scolaire (septembre → août).
    const [anneeDebut] = annee.libelle.split('-').map(Number)
    const mensuels = new Map<string, EncaissementMensuel>()
    for (let m = 0; m < 12; m++) {
      const date = new Date(anneeDebut, 8 + m, 1) // 8 = septembre
      mensuels.set(cleMois(date), {
        mois: cleMois(date),
        libelle: `${MOIS_COURTS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`,
        montant: 0
      })
    }

    const aujourdHui = new Date()
    aujourdHui.setHours(0, 0, 0, 0)
    const demain = new Date(aujourdHui)
    demain.setDate(demain.getDate() + 1)

    for (const inscription of inscriptions) {
      montantAttendu += inscription.montantTotal
      let paye = 0
      for (const paiement of inscription.paiements) {
        paye += paiement.montant

        if (paiement.datePaiement >= aujourdHui && paiement.datePaiement < demain) {
          recettesDuJour += paiement.montant
        }
        const point = mensuels.get(cleMois(paiement.datePaiement))
        if (point) point.montant += paiement.montant
      }
      montantEncaisse += paye
      if (paye < inscription.montantTotal) elevesImpayes++
    }

    return {
      anneeScolaire: annee.libelle,
      totalEleves,
      totalInscriptions: inscriptions.length,
      montantAttendu,
      montantEncaisse,
      soldeRestant: montantAttendu - montantEncaisse,
      elevesImpayes,
      recettesDuJour,
      encaissementsMensuels: [...mensuels.values()]
    }
  })
}
