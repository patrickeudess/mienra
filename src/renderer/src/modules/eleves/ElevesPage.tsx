/**
 * Module Élèves : liste paginée avec recherche, création, consultation,
 * modification et suppression (bloquée si l'élève a des inscriptions).
 */
import { useCallback, useEffect, useState } from 'react'
import type { EleveDetail, EleveListItem, Paginated } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatNombre } from '@/lib/format'
import { EleveDetailModal } from './EleveDetailModal'
import { EleveFormModal } from './EleveFormModal'

const PAR_PAGE = 15

export function ElevesPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [donnees, setDonnees] = useState<Paginated<EleveListItem> | null>(null)
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)

  // Modales : formulaire (création/édition), fiche, confirmation de suppression.
  const [formOuvert, setFormOuvert] = useState(false)
  const [eleveEnEdition, setEleveEnEdition] = useState<EleveDetail | undefined>(undefined)
  const [ficheOuverte, setFicheOuverte] = useState(false)
  const [ficheEleve, setFicheEleve] = useState<EleveDetail | null>(null)
  const [suppression, setSuppression] = useState<EleveListItem | null>(null)

  const charger = useCallback(async (): Promise<void> => {
    const resultat = await window.api.eleves.list({ recherche, page, parPage: PAR_PAGE })
    setDonnees(resultat)
  }, [recherche, page])

  useEffect(() => {
    void charger()
  }, [charger])

  // La recherche revient toujours à la première page.
  const onRecherche = (valeur: string): void => {
    setRecherche(valeur)
    setPage(1)
  }

  const ouvrirFiche = async (id: number): Promise<void> => {
    const resultat = await window.api.eleves.get(id)
    if (resultat.ok) {
      setFicheEleve(resultat.data)
      setFicheOuverte(true)
    }
  }

  const ouvrirEdition = async (id: number): Promise<void> => {
    const resultat = await window.api.eleves.get(id)
    if (resultat.ok) {
      setEleveEnEdition(resultat.data)
      setFormOuvert(true)
    }
  }

  const confirmerSuppression = async (): Promise<void> => {
    if (!suppression || !utilisateur) return
    const resultat = await window.api.eleves.delete(suppression.id, utilisateur.id)
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `${suppression.nom} ${suppression.prenom} a été supprimé.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    setSuppression(null)
    await charger()
  }

  const totalPages = donnees ? Math.max(1, Math.ceil(donnees.total / PAR_PAGE)) : 1

  return (
    <div>
      {/* En-tête : titre + bouton de création */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Élèves</h1>
          {donnees && (
            <p className="text-sm text-gray-500">{formatNombre(donnees.total)} élève(s) enregistré(s)</p>
          )}
        </div>
        <Button
          onClick={() => {
            setEleveEnEdition(undefined)
            setFormOuvert(true)
          }}
        >
          + Nouvel élève
        </Button>
      </div>

      {/* Message de résultat (suppression, etc.) */}
      {message && (
        <p
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === 'succes' ? 'bg-accent-50 text-accent-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.texte}
        </p>
      )}

      {/* Recherche */}
      <div className="mb-4">
        <input
          type="search"
          value={recherche}
          onChange={(e) => onRecherche(e.target.value)}
          placeholder="Rechercher par matricule, nom ou prénom…"
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Matricule</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Prénom</th>
              <th className="px-4 py-3 font-medium">Sexe</th>
              <th className="px-4 py-3 font-medium">Né(e) le</th>
              <th className="px-4 py-3 font-medium">Classe</th>
              <th className="px-4 py-3 font-medium">Tél. parent</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {donnees?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  {recherche ? 'Aucun élève ne correspond à la recherche.' : 'Aucun élève enregistré.'}
                </td>
              </tr>
            )}
            {donnees?.items.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-primary-800">{e.matricule}</td>
                <td className="px-4 py-2.5 font-medium">{e.nom}</td>
                <td className="px-4 py-2.5">{e.prenom}</td>
                <td className="px-4 py-2.5">{e.sexe}</td>
                <td className="px-4 py-2.5">{formatDate(e.dateNaissance)}</td>
                <td className="px-4 py-2.5">
                  {e.classe ?? <span className="text-gray-400">Non inscrit</span>}
                </td>
                <td className="px-4 py-2.5">{e.telephoneParent}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => void ouvrirFiche(e.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
                    >
                      Voir
                    </button>
                    <button
                      type="button"
                      onClick={() => void ouvrirEdition(e.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuppression(e)}
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
            <Button
              variant="secondaire"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      <EleveFormModal
        ouvert={formOuvert}
        onFermer={() => setFormOuvert(false)}
        eleve={eleveEnEdition}
        onEnregistre={() => {
          setMessage({
            type: 'succes',
            texte: eleveEnEdition ? 'Fiche élève mise à jour.' : 'Élève créé avec succès.'
          })
          void charger()
        }}
      />
      <EleveDetailModal ouvert={ficheOuverte} onFermer={() => setFicheOuverte(false)} eleve={ficheEleve} />

      {/* Confirmation de suppression */}
      <Modal
        titre="Confirmer la suppression"
        ouvert={suppression !== null}
        onFermer={() => setSuppression(null)}
        largeur="max-w-md"
      >
        {suppression && (
          <div>
            <p className="text-sm text-gray-700">
              Supprimer définitivement{' '}
              <strong>
                {suppression.nom} {suppression.prenom}
              </strong>{' '}
              ({suppression.matricule}) ?
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
