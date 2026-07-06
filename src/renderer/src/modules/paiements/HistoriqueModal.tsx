/**
 * Historique complet des versements d'une inscription :
 * résumé (total / payé / reste) + liste chronologique des paiements.
 */
import type { HistoriquePaiements } from '@shared/types'
import { MODE_PAIEMENT_LABELS } from '@shared/types'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatFCFA } from '@/lib/format'

interface HistoriqueModalProps {
  ouvert: boolean
  onFermer: () => void
  historique: HistoriquePaiements | null
}

export function HistoriqueModal({ ouvert, onFermer, historique }: HistoriqueModalProps): JSX.Element | null {
  if (!historique) return null

  const pourcentage =
    historique.montantTotal > 0
      ? Math.round((historique.montantPaye / historique.montantTotal) * 100)
      : 0

  return (
    <Modal titre="Historique des paiements" ouvert={ouvert} onFermer={onFermer}>
      {/* Résumé de l'inscription */}
      <div>
        <p className="text-base font-semibold text-primary-900">
          {historique.nomComplet}{' '}
          <span className="font-mono text-xs text-primary-700">({historique.matricule})</span>
        </p>
        <p className="text-sm text-gray-500">
          {historique.classe} : {historique.anneeScolaire}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-xs text-gray-500">Montant total</p>
          <p className="text-lg font-bold tabular-nums text-primary-900">
            {formatFCFA(historique.montantTotal)}
          </p>
        </div>
        <div className="rounded-xl bg-accent-50 px-3 py-2.5">
          <p className="text-xs text-gray-500">Payé ({pourcentage} %)</p>
          <p className="text-lg font-bold tabular-nums text-accent-700">
            {formatFCFA(historique.montantPaye)}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2.5">
          <p className="text-xs text-gray-500">Reste à payer</p>
          <p className="text-lg font-bold tabular-nums text-amber-700">{formatFCFA(historique.reste)}</p>
        </div>
      </div>

      {/* Barre de progression */}
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={pourcentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Pourcentage payé"
      >
        <div className="h-full rounded-full bg-accent-500" style={{ width: `${pourcentage}%` }} />
      </div>

      {/* Versements */}
      <h3 className="mt-5 text-sm font-semibold text-primary-900">
        Versements ({historique.versements.length})
      </h3>
      {historique.versements.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
          Aucun versement pour le moment.
        </p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-2 font-medium">N° reçu</th>
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Mode</th>
              <th className="py-2 font-medium">Caissier</th>
              <th className="py-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {historique.versements.map((v) => (
              <tr key={v.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 font-mono text-xs text-primary-800">{v.numeroRecu}</td>
                <td className="py-2">{formatDate(v.datePaiement)}</td>
                <td className="py-2">{MODE_PAIEMENT_LABELS[v.mode]}</td>
                <td className="py-2">{v.caissier}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatFCFA(v.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
