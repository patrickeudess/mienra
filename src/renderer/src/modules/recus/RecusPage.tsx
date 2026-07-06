/**
 * Module Reçus : chaque paiement a son reçu PDF (généré automatiquement à
 * l'encaissement). Ici : recherche d'un reçu et impression en un clic
 * (le PDF est régénéré s'il a été supprimé du disque).
 */
import { useCallback, useEffect, useState } from 'react'
import type { AnneeScolaireRef, Paginated, PaiementListItem } from '@shared/types'
import { MODE_PAIEMENT_LABELS } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatFCFA, formatNombre } from '@/lib/format'

const PAR_PAGE = 15
const CHAMP_FILTRE =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function RecusPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [donnees, setDonnees] = useState<Paginated<PaiementListItem> | null>(null)
  const [annees, setAnnees] = useState<AnneeScolaireRef[]>([])

  const [recherche, setRecherche] = useState('')
  const [anneeScolaireId, setAnneeScolaireId] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)

  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)
  const [impressionEnCours, setImpressionEnCours] = useState<number | null>(null)

  useEffect(() => {
    void window.api.referentiel.annees().then((listeAnnees) => {
      setAnnees(listeAnnees)
      setAnneeScolaireId(listeAnnees.find((a) => a.active)?.id)
    })
  }, [])

  const charger = useCallback(async (): Promise<void> => {
    const resultat = await window.api.paiements.list({
      recherche,
      anneeScolaireId,
      page,
      parPage: PAR_PAGE
    })
    setDonnees(resultat)
  }, [recherche, anneeScolaireId, page])

  useEffect(() => {
    void charger()
  }, [charger])

  const imprimer = async (paiement: PaiementListItem): Promise<void> => {
    if (!utilisateur) return
    setImpressionEnCours(paiement.id)
    const resultat = await window.api.recus.imprimer(paiement.id, utilisateur.id)
    setImpressionEnCours(null)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Reçu ${paiement.numeroRecu} ouvert : lancez l'impression depuis le lecteur PDF.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
  }

  const totalPages = donnees ? Math.max(1, Math.ceil(donnees.total / PAR_PAGE)) : 1

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Reçus</h1>
          {donnees && (
            <p className="text-sm text-gray-500">{formatNombre(donnees.total)} reçu(s) émis</p>
          )}
        </div>
        <Button variant="secondaire" onClick={() => void window.api.recus.ouvrirDossier()}>
          Ouvrir le dossier des reçus
        </Button>
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
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Impression</th>
            </tr>
          </thead>
          <tbody>
            {donnees?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  Aucun reçu ne correspond aux filtres.
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
                <td className="px-4 py-2.5">{MODE_PAIEMENT_LABELS[p.mode]}</td>
                <td className="px-4 py-2.5">{formatDate(p.datePaiement)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={impressionEnCours === p.id}
                    onClick={() => void imprimer(p)}
                    className="rounded-lg bg-primary-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {impressionEnCours === p.id ? 'Ouverture…' : 'Imprimer'}
                  </button>
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
    </div>
  )
}
