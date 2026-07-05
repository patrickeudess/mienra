/**
 * Tableau de bord : indicateurs clés de l'année scolaire active
 * et graphique mensuel des encaissements.
 */
import { useEffect, useState } from 'react'
import type { DashboardStats } from '@shared/types'
import { StatCard } from '@/components/ui/StatCard'
import { MonthlyChart } from './MonthlyChart'
import { formatFCFA, formatNombre } from '@/lib/format'

export function DashboardPage(): JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    window.api.dashboard
      .stats()
      .then(setStats)
      .catch(() => setErreur('Impossible de charger les statistiques.'))
  }, [])

  if (erreur) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>
  }
  if (!stats) {
    return <p className="text-sm text-gray-500">Chargement du tableau de bord…</p>
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-primary-900">Tableau de bord</h1>
        {stats.anneeScolaire && (
          <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-800">
            Année scolaire {stats.anneeScolaire}
          </span>
        )}
      </div>

      {/* Indicateurs clés */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard libelle="Élèves" valeur={formatNombre(stats.totalEleves)} />
        <StatCard libelle="Inscriptions" valeur={formatNombre(stats.totalInscriptions)} />
        <StatCard libelle="Montant attendu" valeur={formatFCFA(stats.montantAttendu)} />
        <StatCard libelle="Montant encaissé" valeur={formatFCFA(stats.montantEncaisse)} ton="positif" />
        <StatCard libelle="Solde restant" valeur={formatFCFA(stats.soldeRestant)} ton="attention" />
        <StatCard
          libelle="Élèves en impayés"
          valeur={formatNombre(stats.elevesImpayes)}
          ton="attention"
        />
        <StatCard libelle="Recettes du jour" valeur={formatFCFA(stats.recettesDuJour)} ton="positif" />
      </div>

      {/* Graphique mensuel */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-primary-900">
          Encaissements mensuels (FCFA)
        </h2>
        {stats.encaissementsMensuels.length > 0 ? (
          <MonthlyChart donnees={stats.encaissementsMensuels} />
        ) : (
          <p className="py-10 text-center text-sm text-gray-500">
            Aucune année scolaire active : créez-en une dans les paramètres.
          </p>
        )}
      </div>
    </div>
  )
}
