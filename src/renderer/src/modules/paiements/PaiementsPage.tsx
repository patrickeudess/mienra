/**
 * Module Paiements : encaissements avec numéro de reçu automatique,
 * liste filtrable (mode, année scolaire, recherche élève), historique
 * des versements par inscription, annulation réservée à l'Administrateur.
 */
import { useCallback, useEffect, useState } from 'react'
import type {
  AnneeScolaireRef,
  HistoriquePaiements,
  ModePaiement,
  Paginated,
  PaiementListItem
} from '@shared/types'
import { MODE_PAIEMENT_LABELS, MODES_PAIEMENT } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatFCFA, formatNombre } from '@/lib/format'
import { HistoriqueModal } from './HistoriqueModal'
import { PaiementFormModal } from './PaiementFormModal'

const PAR_PAGE = 15
const CHAMP_FILTRE =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

/** Pastille colorée par mode de paiement (identité stable par mode). */
const MODE_BADGES: Record<ModePaiement, string> = {
  ESPECES: 'bg-accent-100 text-accent-800',
  MOBILE_MONEY: 'bg-primary-100 text-primary-800',
  BANQUE: 'bg-gray-200 text-gray-700',
  CHEQUE: 'bg-amber-100 text-amber-800'
}

export function PaiementsPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [donnees, setDonnees] = useState<Paginated<PaiementListItem> | null>(null)
  const [annees, setAnnees] = useState<AnneeScolaireRef[]>([])

  // Filtres.
  const [recherche, setRecherche] = useState('')
  const [mode, setMode] = useState<ModePaiement | undefined>(undefined)
  const [anneeScolaireId, setAnneeScolaireId] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)

  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)
  const [formOuvert, setFormOuvert] = useState(false)
  const [historique, setHistorique] = useState<HistoriquePaiements | null>(null)
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false)
  const [annulation, setAnnulation] = useState<PaiementListItem | null>(null)

  useEffect(() => {
    void window.api.referentiel.annees().then((listeAnnees) => {
      setAnnees(listeAnnees)
      setAnneeScolaireId(listeAnnees.find((a) => a.active)?.id)
    })
  }, [])

  const charger = useCallback(async (): Promise<void> => {
    const resultat = await window.api.paiements.list({
      recherche,
      mode,
      anneeScolaireId,
      page,
      parPage: PAR_PAGE
    })
    setDonnees(resultat)
  }, [recherche, mode, anneeScolaireId, page])

  useEffect(() => {
    void charger()
  }, [charger])

  const ouvrirHistorique = async (inscriptionId: number): Promise<void> => {
    const resultat = await window.api.paiements.historique(inscriptionId)
    if (resultat.ok) {
      setHistorique(resultat.data)
      setHistoriqueOuvert(true)
    }
  }

  const confirmerAnnulation = async (): Promise<void> => {
    if (!annulation || !utilisateur) return
    const resultat = await window.api.paiements.delete(annulation.id, utilisateur.id)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Paiement ${annulation.numeroRecu} annulé.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    setAnnulation(null)
    await charger()
  }

  const totalPages = donnees ? Math.max(1, Math.ceil(donnees.total / PAR_PAGE)) : 1
  const estAdmin = utilisateur?.role === 'ADMINISTRATEUR'

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Paiements</h1>
          {donnees && (
            <p className="text-sm text-gray-500">{formatNombre(donnees.total)} paiement(s)</p>
          )}
        </div>
        <Button onClick={() => setFormOuvert(true)}>+ Nouveau paiement</Button>
      </div>

      {message && (
        <p
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === 'succes' ? 'bg-accent-50 text-accent-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.texte}
        </p>
      )}

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value)
            setPage(1)
          }}
          placeholder="Rechercher un élève…"
          className={`${CHAMP_FILTRE} w-64`}
        />
        <select
          value={anneeScolaireId ?? ''}
          onChange={(e) => {
            setAnneeScolaireId(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par année scolaire"
        >
          <option value="">Toutes les années</option>
          {annees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.libelle}
              {a.active ? ' (active)' : ''}
            </option>
          ))}
        </select>
        <select
          value={mode ?? ''}
          onChange={(e) => {
            setMode(e.target.value ? (e.target.value as ModePaiement) : undefined)
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par mode de paiement"
        >
          <option value="">Tous les modes</option>
          {MODES_PAIEMENT.map((m) => (
            <option key={m} value={m}>
              {MODE_PAIEMENT_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">N° reçu</th>
              <th className="px-4 py-3 font-medium">Élève</th>
              <th className="px-4 py-3 font-medium">Classe</th>
              <th className="px-4 py-3 text-right font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Caissier</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {donnees?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  Aucun paiement ne correspond aux filtres.
                </td>
              </tr>
            )}
            {donnees?.items.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-primary-800">{p.numeroRecu}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{p.nomComplet}</p>
                  <p className="font-mono text-xs text-gray-500">{p.matricule}</p>
                </td>
                <td className="px-4 py-2.5">{p.classe}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatFCFA(p.montant)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MODE_BADGES[p.mode]}`}>
                    {MODE_PAIEMENT_LABELS[p.mode]}
                  </span>
                </td>
                <td className="px-4 py-2.5">{p.caissier}</td>
                <td className="px-4 py-2.5">{formatDate(p.datePaiement)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => void ouvrirHistorique(p.inscriptionId)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
                    >
                      Historique
                    </button>
                    {estAdmin && (
                      <button
                        type="button"
                        onClick={() => setAnnulation(p)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {donnees && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <p>
            Page {donnees.page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondaire" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ← Précédent
            </Button>
            <Button variant="secondaire" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Suivant →
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      <PaiementFormModal
        ouvert={formOuvert}
        onFermer={() => setFormOuvert(false)}
        onEncaisse={(numeroRecu) => {
          setMessage({
            type: 'succes',
            texte: `Paiement encaissé — reçu ${numeroRecu}. L'impression du reçu PDF arrive à l'étape Reçus.`
          })
          void charger()
        }}
      />
      <HistoriqueModal
        ouvert={historiqueOuvert}
        onFermer={() => setHistoriqueOuvert(false)}
        historique={historique}
      />

      {/* Confirmation d'annulation (Administrateur) */}
      <Modal
        titre="Annuler ce paiement ?"
        ouvert={annulation !== null}
        onFermer={() => setAnnulation(null)}
        largeur="max-w-md"
      >
        {annulation && (
          <div>
            <p className="text-sm text-gray-700">
              Annuler le paiement <strong className="font-mono">{annulation.numeroRecu}</strong> de{' '}
              <strong>{formatFCFA(annulation.montant)}</strong> ({annulation.nomComplet}) ?
              L&apos;annulation sera tracée au journal d&apos;activité.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondaire" onClick={() => setAnnulation(null)}>
                Non, conserver
              </Button>
              <Button variant="danger" onClick={() => void confirmerAnnulation()}>
                Oui, annuler
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
