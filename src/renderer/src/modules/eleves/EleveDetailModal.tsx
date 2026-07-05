/**
 * Fiche élève : identité, coordonnées, photo et historique des inscriptions
 * avec l'état des paiements (montant payé / total).
 */
import type { EleveDetail } from '@shared/types'
import { SEXE_LABELS } from '@shared/types'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatFCFA } from '@/lib/format'

interface EleveDetailModalProps {
  ouvert: boolean
  onFermer: () => void
  eleve: EleveDetail | null
}

function Info({ libelle, valeur }: { libelle: string; valeur: string }): JSX.Element {
  return (
    <div>
      <p className="text-xs text-gray-500">{libelle}</p>
      <p className="text-sm font-medium text-gray-900">{valeur}</p>
    </div>
  )
}

export function EleveDetailModal({ ouvert, onFermer, eleve }: EleveDetailModalProps): JSX.Element | null {
  if (!eleve) return null

  return (
    <Modal titre="Fiche élève" ouvert={ouvert} onFermer={onFermer}>
      {/* En-tête : photo + identité */}
      <div className="flex items-center gap-4">
        {eleve.photoDataUrl ? (
          <img
            src={eleve.photoDataUrl}
            alt={`Photo de ${eleve.prenom} ${eleve.nom}`}
            className="h-20 w-20 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary-100 text-2xl font-bold text-primary-700">
            {eleve.prenom[0]}
            {eleve.nom[0]}
          </div>
        )}
        <div>
          <p className="text-xl font-bold text-primary-900">
            {eleve.nom} {eleve.prenom}
          </p>
          <p className="font-mono text-sm text-accent-700">{eleve.matricule}</p>
          <p className="text-xs text-gray-500">Créé le {formatDate(eleve.creeLe)}</p>
        </div>
      </div>

      {/* Informations détaillées */}
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
        <Info libelle="Sexe" valeur={SEXE_LABELS[eleve.sexe]} />
        <Info libelle="Date de naissance" valeur={formatDate(eleve.dateNaissance)} />
        <Info libelle="Lieu de naissance" valeur={eleve.lieuNaissance} />
        <Info libelle="Nationalité" valeur={eleve.nationalite} />
        <Info libelle="Parent / tuteur" valeur={eleve.nomParent} />
        <Info libelle="Téléphone" valeur={eleve.telephoneParent} />
        <div className="col-span-2 sm:col-span-3">
          <Info libelle="Adresse" valeur={eleve.adresse} />
        </div>
      </div>

      {/* Historique des inscriptions */}
      <h3 className="mt-5 text-sm font-semibold text-primary-900">Inscriptions</h3>
      {eleve.inscriptions.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
          Aucune inscription pour le moment.
        </p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-2 font-medium">Année scolaire</th>
              <th className="py-2 font-medium">Classe</th>
              <th className="py-2 text-right font-medium">Payé / Total</th>
            </tr>
          </thead>
          <tbody>
            {eleve.inscriptions.map((i) => (
              <tr key={i.id} className="border-b border-gray-100">
                <td className="py-2">{i.anneeScolaire}</td>
                <td className="py-2">{i.classe}</td>
                <td className="py-2 text-right tabular-nums">
                  <span
                    className={i.montantPaye >= i.montantTotal ? 'text-accent-700' : 'text-amber-700'}
                  >
                    {formatFCFA(i.montantPaye)}
                  </span>{' '}
                  <span className="text-gray-400">/ {formatFCFA(i.montantTotal)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
