/**
 * Formulaire d'inscription : choix de l'élève (recherche), de la classe et
 * de l'année scolaire, saisie des montants avec calcul automatique du total.
 * En modification, l'élève et l'année sont verrouillés (seuls la classe et
 * les montants peuvent changer).
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  inscriptionInputSchema,
  type AnneeScolaireRef,
  type ClasseRef,
  type EleveListItem,
  type InscriptionInput,
  type InscriptionListItem
} from '@shared/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { formatFCFA } from '@/lib/format'

interface InscriptionFormModalProps {
  ouvert: boolean
  onFermer: () => void
  /** Inscription à modifier ; undefined = nouvelle inscription. */
  inscription?: InscriptionListItem
  classes: ClasseRef[]
  annees: AnneeScolaireRef[]
  onEnregistre: () => void
}

const CHAMP =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function InscriptionFormModal({
  ouvert,
  onFermer,
  inscription,
  classes,
  annees,
  onEnregistre
}: InscriptionFormModalProps): JSX.Element {
  const { utilisateur } = useAuth()
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)

  // Sélecteur d'élève (création uniquement).
  const [rechercheEleve, setRechercheEleve] = useState('')
  const [suggestions, setSuggestions] = useState<EleveListItem[]>([])
  const [eleveChoisi, setEleveChoisi] = useState<EleveListItem | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<InscriptionInput>({ resolver: zodResolver(inscriptionInputSchema) })

  // Total affiché en direct.
  const [scolarite, fraisInscription, autresFrais] = watch([
    'scolarite',
    'fraisInscription',
    'autresFrais'
  ])
  const total = (scolarite || 0) + (fraisInscription || 0) + (autresFrais || 0)

  // Initialisation à l'ouverture.
  useEffect(() => {
    if (!ouvert) return
    setErreurServeur(null)
    setRechercheEleve('')
    setSuggestions([])
    setEleveChoisi(null)
    const anneeActive = annees.find((a) => a.active)
    reset(
      inscription
        ? {
            eleveId: inscription.eleveId,
            classeId: classes.find((c) => c.nom === inscription.classe)?.id,
            anneeScolaireId: annees.find((a) => a.libelle === inscription.anneeScolaire)?.id,
            scolarite: inscription.scolarite,
            fraisInscription: inscription.fraisInscription,
            autresFrais: inscription.autresFrais
          }
        : {
            anneeScolaireId: anneeActive?.id,
            scolarite: 0,
            fraisInscription: 0,
            autresFrais: 0
          }
    )
  }, [ouvert, inscription, annees, classes, reset])

  // Recherche d'élèves (création) : suggestions au fil de la saisie.
  useEffect(() => {
    if (!ouvert || inscription || rechercheEleve.trim().length < 2) {
      setSuggestions([])
      return
    }
    let annule = false
    void window.api.eleves
      .list({ recherche: rechercheEleve.trim(), page: 1, parPage: 8 })
      .then((r) => {
        if (!annule) setSuggestions(r.items)
      })
    return () => {
      annule = true
    }
  }, [rechercheEleve, ouvert, inscription])

  const choisirEleve = (eleve: EleveListItem): void => {
    setEleveChoisi(eleve)
    setValue('eleveId', eleve.id, { shouldValidate: true })
    setSuggestions([])
    setRechercheEleve('')
  }

  const onSubmit = async (input: InscriptionInput): Promise<void> => {
    if (!utilisateur) return
    setErreurServeur(null)
    const resultat = inscription
      ? await window.api.inscriptions.update(
          inscription.id,
          {
            classeId: input.classeId,
            scolarite: input.scolarite,
            fraisInscription: input.fraisInscription,
            autresFrais: input.autresFrais
          },
          utilisateur.id
        )
      : await window.api.inscriptions.create(input, utilisateur.id)
    if (!resultat.ok) {
      setErreurServeur(resultat.erreur)
      return
    }
    onEnregistre()
    onFermer()
  }

  return (
    <Modal
      titre={inscription ? `Modifier l'inscription — ${inscription.matricule}` : 'Nouvelle inscription'}
      ouvert={ouvert}
      onFermer={onFermer}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Élève */}
        {inscription ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
            Élève : <strong>{inscription.nomComplet}</strong>{' '}
            <span className="font-mono text-xs text-primary-800">({inscription.matricule})</span> —{' '}
            {inscription.anneeScolaire}
          </p>
        ) : (
          <div>
            <label htmlFor="rechercheEleve" className="mb-1 block text-sm font-medium text-gray-700">
              Élève *
            </label>
            {eleveChoisi ? (
              <div className="flex items-center justify-between rounded-lg border border-accent-300 bg-accent-50 px-3 py-2">
                <p className="text-sm">
                  <strong>
                    {eleveChoisi.nom} {eleveChoisi.prenom}
                  </strong>{' '}
                  <span className="font-mono text-xs text-primary-800">{eleveChoisi.matricule}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEleveChoisi(null)
                    setValue('eleveId', 0)
                  }}
                  className="text-xs font-medium text-gray-500 hover:text-red-600"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  id="rechercheEleve"
                  type="search"
                  value={rechercheEleve}
                  onChange={(e) => setRechercheEleve(e.target.value)}
                  placeholder="Rechercher par matricule, nom ou prénom (2 caractères min.)…"
                  className={CHAMP}
                />
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    {suggestions.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => choisirEleve(e)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50"
                        >
                          <span>
                            {e.nom} {e.prenom}
                          </span>
                          <span className="font-mono text-xs text-gray-500">{e.matricule}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {errors.eleveId && <p className="mt-1 text-xs text-red-600">Choisissez un élève</p>}
          </div>
        )}

        {/* Classe + année scolaire */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="classeId" className="mb-1 block text-sm font-medium text-gray-700">
              Classe *
            </label>
            <select id="classeId" className={CHAMP} {...register('classeId', { valueAsNumber: true })}>
              <option value="">— Choisir —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            {errors.classeId && <p className="mt-1 text-xs text-red-600">Choisissez une classe</p>}
          </div>
          <div>
            <label htmlFor="anneeScolaireId" className="mb-1 block text-sm font-medium text-gray-700">
              Année scolaire *
            </label>
            <select
              id="anneeScolaireId"
              className={CHAMP}
              disabled={inscription !== undefined}
              {...register('anneeScolaireId', { valueAsNumber: true })}
            >
              {annees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                  {a.active ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Montants */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="scolarite" className="mb-1 block text-sm font-medium text-gray-700">
              Scolarité (FCFA) *
            </label>
            <input
              id="scolarite"
              type="number"
              min="0"
              step="1"
              className={CHAMP}
              {...register('scolarite', { valueAsNumber: true })}
            />
            {errors.scolarite && <p className="mt-1 text-xs text-red-600">{errors.scolarite.message}</p>}
          </div>
          <div>
            <label htmlFor="fraisInscription" className="mb-1 block text-sm font-medium text-gray-700">
              Frais d&apos;inscription *
            </label>
            <input
              id="fraisInscription"
              type="number"
              min="0"
              step="1"
              className={CHAMP}
              {...register('fraisInscription', { valueAsNumber: true })}
            />
            {errors.fraisInscription && (
              <p className="mt-1 text-xs text-red-600">{errors.fraisInscription.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="autresFrais" className="mb-1 block text-sm font-medium text-gray-700">
              Autres frais
            </label>
            <input
              id="autresFrais"
              type="number"
              min="0"
              step="1"
              className={CHAMP}
              {...register('autresFrais', { valueAsNumber: true })}
            />
            {errors.autresFrais && (
              <p className="mt-1 text-xs text-red-600">{errors.autresFrais.message}</p>
            )}
          </div>
        </div>

        {/* Total calculé automatiquement */}
        <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
          <p className="text-sm font-medium text-primary-800">Montant total</p>
          <p className="text-xl font-bold tabular-nums text-primary-900">
            {formatFCFA(Number.isFinite(total) ? total : 0)}
          </p>
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
