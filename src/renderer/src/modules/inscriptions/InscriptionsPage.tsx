/**
 * Module Inscriptions : liste filtrable (année scolaire, classe, recherche
 * élève), création, modification et suppression (si aucun paiement).
 */
import { useCallback, useEffect, useState } from 'react'
import type {
  AnneeScolaireRef,
  ClasseRef,
  InscriptionListItem,
  Paginated
} from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatFCFA, formatNombre } from '@/lib/format'
import { InscriptionFormModal } from './InscriptionFormModal'

const PAR_PAGE = 15
const CHAMP_FILTRE =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function InscriptionsPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [donnees, setDonnees] = useState<Paginated<InscriptionListItem> | null>(null)
  const [classes, setClasses] = useState<ClasseRef[]>([])
  const [annees, setAnnees] = useState<AnneeScolaireRef[]>([])

  // Filtres.
  const [recherche, setRecherche] = useState('')
  const [classeId, setClasseId] = useState<number | undefined>(undefined)
  const [anneeScolaireId, setAnneeScolaireId] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)

  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)
  const [formOuvert, setFormOuvert] = useState(false)
  const [enEdition, setEnEdition] = useState<InscriptionListItem | undefined>(undefined)
  const [suppression, setSuppression] = useState<InscriptionListItem | null>(null)

  // Référentiel chargé une fois ; le filtre année démarre sur l'année active.
  useEffect(() => {
    void Promise.all([window.api.referentiel.classes(), window.api.referentiel.annees()]).then(
      ([listeClasses, listeAnnees]) => {
        setClasses(listeClasses)
        setAnnees(listeAnnees)
        setAnneeScolaireId(listeAnnees.find((a) => a.active)?.id)
      }
    )
  }, [])

  const charger = useCallback(async (): Promise<void> => {
    const resultat = await window.api.inscriptions.list({
      recherche,
      classeId,
      anneeScolaireId,
      page,
      parPage: PAR_PAGE
    })
    setDonnees(resultat)
  }, [recherche, classeId, anneeScolaireId, page])

  useEffect(() => {
    void charger()
  }, [charger])

  const confirmerSuppression = async (): Promise<void> => {
    if (!suppression || !utilisateur) return
    const resultat = await window.api.inscriptions.delete(suppression.id, utilisateur.id)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Inscription de ${suppression.nomComplet} supprimée.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    setSuppression(null)
    await charger()
  }

  const totalPages = donnees ? Math.max(1, Math.ceil(donnees.total / PAR_PAGE)) : 1

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Inscriptions</h1>
          {donnees && (
            <p className="text-sm text-gray-500">{formatNombre(donnees.total)} inscription(s)</p>
          )}
        </div>
        <Button
          onClick={() => {
            setEnEdition(undefined)
            setFormOuvert(true)
          }}
        >
          + Nouvelle inscription
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

      {/* Filtres : une seule rangée au-dessus du tableau */}
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
          value={classeId ?? ''}
          onChange={(e) => {
            setClasseId(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par classe"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Élève</th>
              <th className="px-4 py-3 font-medium">Classe</th>
              <th className="px-4 py-3 font-medium">Année</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Payé</th>
              <th className="px-4 py-3 text-right font-medium">Reste</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {donnees?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  Aucune inscription ne correspond aux filtres.
                </td>
              </tr>
            )}
            {donnees?.items.map((i) => (
              <tr key={i.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{i.nomComplet}</p>
                  <p className="font-mono text-xs text-primary-800">{i.matricule}</p>
                </td>
                <td className="px-4 py-2.5">{i.classe}</td>
                <td className="px-4 py-2.5">{i.anneeScolaire}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatFCFA(i.montantTotal)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-accent-700">
                  {formatFCFA(i.montantPaye)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                    i.reste > 0 ? 'text-amber-700' : 'text-accent-700'
                  }`}
                >
                  {i.reste > 0 ? formatFCFA(i.reste) : 'Soldé'}
                </td>
                <td className="px-4 py-2.5">{formatDate(i.dateInscription)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEnEdition(i)
                        setFormOuvert(true)
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuppression(i)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
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
      <InscriptionFormModal
        ouvert={formOuvert}
        onFermer={() => setFormOuvert(false)}
        inscription={enEdition}
        classes={classes}
        annees={annees}
        onEnregistre={() => {
          setMessage({
            type: 'succes',
            texte: enEdition ? 'Inscription mise à jour.' : 'Inscription enregistrée.'
          })
          void charger()
        }}
      />

      <Modal
        titre="Confirmer la suppression"
        ouvert={suppression !== null}
        onFermer={() => setSuppression(null)}
        largeur="max-w-md"
      >
        {suppression && (
          <div>
            <p className="text-sm text-gray-700">
              Supprimer l&apos;inscription de <strong>{suppression.nomComplet}</strong> en{' '}
              {suppression.classe} ({suppression.anneeScolaire}) ?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondaire" onClick={() => setSuppression(null)}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => void confirmerSuppression()}>
                Supprimer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
