/**
 * Module Utilisateurs (réservé à l'Administrateur) : liste des comptes,
 * création, modification, activation/désactivation et réinitialisation de
 * mot de passe. Les garde-fous définitifs sont appliqués côté main.
 */
import { useCallback, useEffect, useState } from 'react'
import type { UtilisateurListItem } from '@shared/types'
import { ROLE_LABELS } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/format'
import { UtilisateurFormModal } from './UtilisateurFormModal'

export function UtilisateursPage(): JSX.Element {
  const { utilisateur } = useAuth()
  const [comptes, setComptes] = useState<UtilisateurListItem[]>([])
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)

  const [formOuvert, setFormOuvert] = useState(false)
  const [enEdition, setEnEdition] = useState<UtilisateurListItem | undefined>(undefined)
  const [resetCible, setResetCible] = useState<UtilisateurListItem | null>(null)
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('')

  const estAdmin = utilisateur?.role === 'ADMINISTRATEUR'

  const charger = useCallback(async (): Promise<void> => {
    if (!utilisateur) return
    const resultat = await window.api.utilisateurs.list(utilisateur.id)
    if (resultat.ok) setComptes(resultat.data)
  }, [utilisateur])

  useEffect(() => {
    void charger()
  }, [charger])

  const basculerActif = async (compte: UtilisateurListItem): Promise<void> => {
    if (!utilisateur) return
    const resultat = await window.api.utilisateurs.setActif(compte.id, !compte.actif, utilisateur.id)
    setMessage(
      resultat.ok
        ? {
            type: 'succes',
            texte: `Compte ${compte.identifiant} ${compte.actif ? 'désactivé' : 'activé'}.`
          }
        : { type: 'erreur', texte: resultat.erreur }
    )
    await charger()
  }

  const reinitialiser = async (): Promise<void> => {
    if (!resetCible || !utilisateur) return
    const resultat = await window.api.utilisateurs.resetMotDePasse(
      resetCible.id,
      nouveauMotDePasse,
      utilisateur.id
    )
    setMessage(
      resultat.ok
        ? { type: 'succes', texte: `Mot de passe de ${resetCible.identifiant} réinitialisé.` }
        : { type: 'erreur', texte: resultat.erreur }
    )
    if (resultat.ok) {
      setResetCible(null)
      setNouveauMotDePasse('')
    }
  }

  // Les autres rôles n'ont pas accès à ce module (les handlers refusent
  // aussi côté main — ceci n'est que l'affichage).
  if (!estAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Utilisateurs</h1>
        <p className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          Ce module est réservé à l&apos;administrateur.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500">{comptes.length} compte(s)</p>
        </div>
        <Button
          onClick={() => {
            setEnEdition(undefined)
            setFormOuvert(true)
          }}
        >
          + Nouvel utilisateur
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

      {/* Tableau des comptes */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Identifiant</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Créé le</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">
                  {c.nom}
                  {c.id === utilisateur?.id && (
                    <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-800">
                      vous
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{c.identifiant}</td>
                <td className="px-4 py-2.5">{ROLE_LABELS[c.role]}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.actif ? 'bg-accent-100 text-accent-800' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {c.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td className="px-4 py-2.5">{formatDate(c.creeLe)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEnEdition(c)
                        setFormOuvert(true)
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetCible(c)
                        setNouveauMotDePasse('')
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
                    >
                      Mot de passe
                    </button>
                    {c.id !== utilisateur?.id && (
                      <button
                        type="button"
                        onClick={() => void basculerActif(c)}
                        className={`rounded-lg px-2 py-1 text-xs font-medium ${
                          c.actif ? 'text-red-600 hover:bg-red-50' : 'text-accent-700 hover:bg-accent-50'
                        }`}
                      >
                        {c.actif ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modales */}
      <UtilisateurFormModal
        ouvert={formOuvert}
        onFermer={() => setFormOuvert(false)}
        compte={enEdition}
        onEnregistre={() => {
          setMessage({
            type: 'succes',
            texte: enEdition ? 'Compte mis à jour.' : 'Compte créé avec succès.'
          })
          void charger()
        }}
      />

      <Modal
        titre={`Réinitialiser le mot de passe${resetCible ? ` : ${resetCible.identifiant}` : ''}`}
        ouvert={resetCible !== null}
        onFermer={() => setResetCible(null)}
        largeur="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="nouveauMotDePasse" className="mb-1 block text-sm font-medium text-gray-700">
              Nouveau mot de passe (6 caractères min.)
            </label>
            <input
              id="nouveauMotDePasse"
              type="password"
              autoComplete="new-password"
              value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondaire" onClick={() => setResetCible(null)}>
              Annuler
            </Button>
            <Button disabled={nouveauMotDePasse.length < 6} onClick={() => void reinitialiser()}>
              Réinitialiser
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
