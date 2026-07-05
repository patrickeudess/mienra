/**
 * Journal d'activité (Administrateur et Directeur) : date, heure,
 * utilisateur, action, détails et poste, avec filtres par action,
 * utilisateur et période.
 */
import { useCallback, useEffect, useState } from 'react'
import type {
  ActionJournal,
  JournalListItem,
  Paginated,
  UtilisateurRef
} from '@shared/types'
import { ACTION_JOURNAL_LABELS, ACTIONS_JOURNAL } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { formatNombre } from '@/lib/format'

const PAR_PAGE = 20
const CHAMP_FILTRE =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

/** Couleur de pastille par famille d'action (identité stable). */
function classeAction(action: ActionJournal): string {
  if (action === 'PAIEMENT' || action === 'IMPRESSION_RECU') return 'bg-accent-100 text-accent-800'
  if (action === 'SUPPRESSION_ELEVE') return 'bg-red-100 text-red-700'
  if (action === 'CONNEXION' || action === 'DECONNEXION') return 'bg-gray-200 text-gray-700'
  return 'bg-primary-100 text-primary-800'
}

export function JournalPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [donnees, setDonnees] = useState<Paginated<JournalListItem> | null>(null)
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurRef[]>([])
  const [erreurAcces, setErreurAcces] = useState<string | null>(null)

  // Filtres : action, utilisateur, période.
  const [action, setAction] = useState<ActionJournal | undefined>(undefined)
  const [utilisateurId, setUtilisateurId] = useState<number | undefined>(undefined)
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!utilisateur) return
    void window.api.journal.utilisateurs(utilisateur.id).then((r) => {
      if (r.ok) setUtilisateurs(r.data)
    })
  }, [utilisateur])

  const charger = useCallback(async (): Promise<void> => {
    if (!utilisateur) return
    const resultat = await window.api.journal.list(
      {
        action,
        utilisateurId,
        du: du || undefined,
        au: au || undefined,
        page,
        parPage: PAR_PAGE
      },
      utilisateur.id
    )
    if (!resultat.ok) {
      setErreurAcces(resultat.erreur)
      return
    }
    setErreurAcces(null)
    setDonnees(resultat.data)
  }, [utilisateur, action, utilisateurId, du, au, page])

  useEffect(() => {
    void charger()
  }, [charger])

  if (erreurAcces) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Journal d&apos;activité</h1>
        <p className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          {erreurAcces}
        </p>
      </div>
    )
  }

  const totalPages = donnees ? Math.max(1, Math.ceil(donnees.total / PAR_PAGE)) : 1

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-900">Journal d&apos;activité</h1>
        {donnees && (
          <p className="text-sm text-gray-500">{formatNombre(donnees.total)} entrée(s)</p>
        )}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={action ?? ''}
          onChange={(e) => {
            setAction(e.target.value ? (e.target.value as ActionJournal) : undefined)
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par action"
        >
          <option value="">Toutes les actions</option>
          {ACTIONS_JOURNAL.map((a) => (
            <option key={a} value={a}>
              {ACTION_JOURNAL_LABELS[a]}
            </option>
          ))}
        </select>
        <select
          value={utilisateurId ?? ''}
          onChange={(e) => {
            setUtilisateurId(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
          className={CHAMP_FILTRE}
          aria-label="Filtrer par utilisateur"
        >
          <option value="">Tous les utilisateurs</option>
          {utilisateurs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nom}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Du
          <input
            type="date"
            value={du}
            onChange={(e) => {
              setDu(e.target.value)
              setPage(1)
            }}
            className={CHAMP_FILTRE}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Au
          <input
            type="date"
            value={au}
            onChange={(e) => {
              setAu(e.target.value)
              setPage(1)
            }}
            className={CHAMP_FILTRE}
          />
        </label>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Heure</th>
              <th className="px-4 py-3 font-medium">Utilisateur</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Détails</th>
              <th className="px-4 py-3 font-medium">Poste</th>
            </tr>
          </thead>
          <tbody>
            {donnees?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Aucune entrée pour les filtres choisis.
                </td>
              </tr>
            )}
            {donnees?.items.map((e) => {
              const d = new Date(e.date)
              return (
                <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 whitespace-nowrap">{d.toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                    {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2.5">
                    {e.utilisateur ?? <span className="text-gray-400">Système</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${classeAction(e.action)}`}
                    >
                      {ACTION_JOURNAL_LABELS[e.action]}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-2.5 text-gray-600">{e.details}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{e.poste}</td>
                </tr>
              )
            })}
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
