/**
 * Formulaire de création / modification d'un compte utilisateur.
 * En modification : l'identifiant est verrouillé et le mot de passe ne se
 * change pas ici (bouton « Réinitialiser » dédié dans la liste).
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ROLE_LABELS,
  ROLES,
  utilisateurInputSchema,
  type UtilisateurInput,
  type UtilisateurListItem
} from '@shared/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

interface UtilisateurFormModalProps {
  ouvert: boolean
  onFermer: () => void
  /** Compte à modifier ; undefined = création. */
  compte?: UtilisateurListItem
  onEnregistre: () => void
}

const CHAMP =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function UtilisateurFormModal({
  ouvert,
  onFermer,
  compte,
  onEnregistre
}: UtilisateurFormModalProps): JSX.Element {
  const { utilisateur } = useAuth()
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<UtilisateurInput>({ resolver: zodResolver(utilisateurInputSchema) })

  useEffect(() => {
    if (!ouvert) return
    setErreurServeur(null)
    reset(
      compte
        ? {
            nom: compte.nom,
            identifiant: compte.identifiant,
            // Champ requis par le schéma mais ignoré en modification.
            motDePasse: 'inchangé',
            role: compte.role
          }
        : { role: 'SECRETAIRE_COMPTABLE' }
    )
  }, [ouvert, compte, reset])

  const onSubmit = async (input: UtilisateurInput): Promise<void> => {
    if (!utilisateur) return
    setErreurServeur(null)
    const resultat = compte
      ? await window.api.utilisateurs.update(
          compte.id,
          { nom: input.nom, role: input.role },
          utilisateur.id
        )
      : await window.api.utilisateurs.create(input, utilisateur.id)
    if (!resultat.ok) {
      setErreurServeur(resultat.erreur)
      return
    }
    onEnregistre()
    onFermer()
  }

  return (
    <Modal
      titre={compte ? `Modifier : ${compte.identifiant}` : 'Nouvel utilisateur'}
      ouvert={ouvert}
      onFermer={onFermer}
      largeur="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="nomUtilisateur" className="mb-1 block text-sm font-medium text-gray-700">
            Nom complet *
          </label>
          <input id="nomUtilisateur" className={CHAMP} {...register('nom')} />
          {errors.nom && <p className="mt-1 text-xs text-red-600">{errors.nom.message}</p>}
        </div>

        <div>
          <label htmlFor="identifiant" className="mb-1 block text-sm font-medium text-gray-700">
            Identifiant de connexion *
          </label>
          <input
            id="identifiant"
            className={CHAMP}
            disabled={compte !== undefined}
            autoComplete="off"
            {...register('identifiant')}
          />
          {errors.identifiant && (
            <p className="mt-1 text-xs text-red-600">{errors.identifiant.message}</p>
          )}
        </div>

        {compte === undefined && (
          <div>
            <label htmlFor="motDePasse" className="mb-1 block text-sm font-medium text-gray-700">
              Mot de passe *
            </label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="new-password"
              className={CHAMP}
              {...register('motDePasse')}
            />
            {errors.motDePasse && (
              <p className="mt-1 text-xs text-red-600">{errors.motDePasse.message}</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-gray-700">
            Rôle *
          </label>
          <select id="role" className={CHAMP} {...register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {erreurServeur && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreurServeur}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="secondaire" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
