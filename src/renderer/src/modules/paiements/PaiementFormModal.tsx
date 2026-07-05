/**
 * Formulaire d'encaissement : recherche de l'inscription (par élève),
 * affichage du total / payé / reste, saisie du montant et du mode.
 * Le contrôle définitif (montant ≤ reste) est refait côté main.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  MODE_PAIEMENT_LABELS,
  MODES_PAIEMENT,
  paiementInputSchema,
  type InscriptionListItem,
  type PaiementInput
} from '@shared/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { formatFCFA } from '@/lib/format'

interface PaiementFormModalProps {
  ouvert: boolean
  onFermer: () => void
  /** Appelé après un encaissement réussi, avec le numéro de reçu. */
  onEncaisse: (numeroRecu: string) => void
}

const CHAMP =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function PaiementFormModal({ ouvert, onFermer, onEncaisse }: PaiementFormModalProps): JSX.Element {
  const { utilisateur } = useAuth()
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)

  // Recherche de l'inscription à encaisser.
  const [recherche, setRecherche] = useState('')
  const [suggestions, setSuggestions] = useState<InscriptionListItem[]>([])
  const [inscription, setInscription] = useState<InscriptionListItem | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<PaiementInput>({ resolver: zodResolver(paiementInputSchema) })

  useEffect(() => {
    if (!ouvert) return
    setErreurServeur(null)
    setRecherche('')
    setSuggestions([])
    setInscription(null)
    reset({ mode: 'ESPECES' })
  }, [ouvert, reset])

  // Suggestions : inscriptions non soldées correspondant à la recherche.
  useEffect(() => {
    if (!ouvert || inscription || recherche.trim().length < 2) {
      setSuggestions([])
      return
    }
    let annule = false
    void window.api.inscriptions
      .list({ recherche: recherche.trim(), page: 1, parPage: 8 })
      .then((r) => {
        if (!annule) setSuggestions(r.items.filter((i) => i.reste > 0))
      })
    return () => {
      annule = true
    }
  }, [recherche, ouvert, inscription])

  const choisirInscription = (i: InscriptionListItem): void => {
    setInscription(i)
    setValue('inscriptionId', i.id, { shouldValidate: true })
    setSuggestions([])
    setRecherche('')
  }

  const onSubmit = async (input: PaiementInput): Promise<void> => {
    if (!utilisateur) return
    setErreurServeur(null)
    const resultat = await window.api.paiements.create(input, utilisateur.id)
    if (!resultat.ok) {
      setErreurServeur(resultat.erreur)
      return
    }
    onEncaisse(resultat.data.numeroRecu)
    onFermer()
  }

  return (
    <Modal titre="Nouveau paiement" ouvert={ouvert} onFermer={onFermer}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Inscription à encaisser */}
        <div>
          <label htmlFor="rechercheInscription" className="mb-1 block text-sm font-medium text-gray-700">
            Élève (inscription à encaisser) *
          </label>
          {inscription ? (
            <div className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <strong>{inscription.nomComplet}</strong>{' '}
                  <span className="font-mono text-xs text-primary-800">({inscription.matricule})</span>{' '}
                  — {inscription.classe}, {inscription.anneeScolaire}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInscription(null)
                    setValue('inscriptionId', 0)
                  }}
                  className="text-xs font-medium text-gray-500 hover:text-red-600"
                >
                  Changer
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-white px-2 py-1.5">
                  <p className="text-gray-500">Total</p>
                  <p className="font-bold tabular-nums">{formatFCFA(inscription.montantTotal)}</p>
                </div>
                <div className="rounded-lg bg-white px-2 py-1.5">
                  <p className="text-gray-500">Déjà payé</p>
                  <p className="font-bold tabular-nums text-accent-700">
                    {formatFCFA(inscription.montantPaye)}
                  </p>
                </div>
                <div className="rounded-lg bg-white px-2 py-1.5">
                  <p className="text-gray-500">Reste à payer</p>
                  <p className="font-bold tabular-nums text-amber-700">{formatFCFA(inscription.reste)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                id="rechercheInscription"
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher par matricule, nom ou prénom (2 caractères min.)…"
                className={CHAMP}
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  {suggestions.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => choisirInscription(i)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50"
                      >
                        <span>
                          {i.nomComplet}{' '}
                          <span className="text-xs text-gray-500">
                            — {i.classe}, {i.anneeScolaire}
                          </span>
                        </span>
                        <span className="text-xs font-medium text-amber-700">
                          Reste {formatFCFA(i.reste)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {errors.inscriptionId && (
            <p className="mt-1 text-xs text-red-600">Choisissez une inscription</p>
          )}
        </div>

        {/* Montant + mode */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="montant" className="mb-1 block text-sm font-medium text-gray-700">
              Montant versé (FCFA) *
            </label>
            <input
              id="montant"
              type="number"
              min="1"
              step="1"
              className={CHAMP}
              {...register('montant', { valueAsNumber: true })}
            />
            {errors.montant && <p className="mt-1 text-xs text-red-600">{errors.montant.message}</p>}
          </div>
          <div>
            <label htmlFor="mode" className="mb-1 block text-sm font-medium text-gray-700">
              Mode de paiement *
            </label>
            <select id="mode" className={CHAMP} {...register('mode')}>
              {MODES_PAIEMENT.map((m) => (
                <option key={m} value={m}>
                  {MODE_PAIEMENT_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Caissier */}
        {utilisateur && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Caissier : <strong>{utilisateur.nom}</strong> — le numéro de reçu sera généré
            automatiquement (ex. REC-2026-00001).
          </p>
        )}

        {erreurServeur && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreurServeur}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="secondaire" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Encaissement…' : 'Encaisser'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
