/**
 * Formulaire de création / modification d'un élève (React Hook Form + Zod).
 * La photo est optionnelle : convertie en base64 et envoyée au processus
 * principal qui l'enregistre sur le disque.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  eleveInputSchema,
  SEXE_LABELS,
  SEXES,
  type EleveDetail,
  type EleveInput
} from '@shared/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { fichierVersPhoto } from '@/lib/fichiers'

interface EleveFormModalProps {
  ouvert: boolean
  onFermer: () => void
  /** Élève à modifier ; undefined = création. */
  eleve?: EleveDetail
  /** Appelé après un enregistrement réussi. */
  onEnregistre: () => void
}

const CHAMP =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function EleveFormModal({ ouvert, onFermer, eleve, onEnregistre }: EleveFormModalProps): JSX.Element {
  const { utilisateur } = useAuth()
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<EleveInput>({ resolver: zodResolver(eleveInputSchema) })

  // Pré-remplit le formulaire à l'ouverture (modification) ou le vide (création).
  useEffect(() => {
    if (!ouvert) return
    setErreurServeur(null)
    setErreurPhoto(null)
    reset(
      eleve
        ? {
            nom: eleve.nom,
            prenom: eleve.prenom,
            sexe: eleve.sexe,
            dateNaissance: eleve.dateNaissance.slice(0, 10),
            lieuNaissance: eleve.lieuNaissance,
            nationalite: eleve.nationalite,
            telephoneParent: eleve.telephoneParent,
            nomParent: eleve.nomParent,
            adresse: eleve.adresse
          }
        : { sexe: 'M', nationalite: 'Ivoirienne' }
    )
  }, [ouvert, eleve, reset])

  const onChoixPhoto = async (fichier: File | undefined): Promise<void> => {
    setErreurPhoto(null)
    if (!fichier) return
    const photo = await fichierVersPhoto(fichier)
    if (!photo) {
      setErreurPhoto('Format accepté : JPG, PNG ou WEBP.')
      return
    }
    setValue('photo', photo)
  }

  const onSubmit = async (input: EleveInput): Promise<void> => {
    if (!utilisateur) return
    setErreurServeur(null)
    const resultat = eleve
      ? await window.api.eleves.update(eleve.id, input, utilisateur.id)
      : await window.api.eleves.create(input, utilisateur.id)
    if (!resultat.ok) {
      setErreurServeur(resultat.erreur)
      return
    }
    onEnregistre()
    onFermer()
  }

  return (
    <Modal titre={eleve ? `Modifier : ${eleve.matricule}` : 'Nouvel élève'} ouvert={ouvert} onFermer={onFermer}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-2 gap-4">
        {eleve === undefined && (
          <p className="col-span-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800">
            Le matricule sera généré automatiquement (ex. MIENRA-2026-0001). La classe et
            l&apos;année scolaire seront choisies lors de l&apos;inscription.
          </p>
        )}

        <div>
          <label htmlFor="nom" className="mb-1 block text-sm font-medium text-gray-700">Nom *</label>
          <input id="nom" className={CHAMP} {...register('nom')} />
          {errors.nom && <p className="mt-1 text-xs text-red-600">{errors.nom.message}</p>}
        </div>
        <div>
          <label htmlFor="prenom" className="mb-1 block text-sm font-medium text-gray-700">Prénom *</label>
          <input id="prenom" className={CHAMP} {...register('prenom')} />
          {errors.prenom && <p className="mt-1 text-xs text-red-600">{errors.prenom.message}</p>}
        </div>

        <div>
          <label htmlFor="sexe" className="mb-1 block text-sm font-medium text-gray-700">Sexe *</label>
          <select id="sexe" className={CHAMP} {...register('sexe')}>
            {SEXES.map((s) => (
              <option key={s} value={s}>{SEXE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dateNaissance" className="mb-1 block text-sm font-medium text-gray-700">
            Date de naissance *
          </label>
          <input id="dateNaissance" type="date" className={CHAMP} {...register('dateNaissance')} />
          {errors.dateNaissance && (
            <p className="mt-1 text-xs text-red-600">{errors.dateNaissance.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="lieuNaissance" className="mb-1 block text-sm font-medium text-gray-700">
            Lieu de naissance *
          </label>
          <input id="lieuNaissance" className={CHAMP} {...register('lieuNaissance')} />
          {errors.lieuNaissance && (
            <p className="mt-1 text-xs text-red-600">{errors.lieuNaissance.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="nationalite" className="mb-1 block text-sm font-medium text-gray-700">
            Nationalité *
          </label>
          <input id="nationalite" className={CHAMP} {...register('nationalite')} />
          {errors.nationalite && (
            <p className="mt-1 text-xs text-red-600">{errors.nationalite.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="nomParent" className="mb-1 block text-sm font-medium text-gray-700">
            Nom du parent / tuteur *
          </label>
          <input id="nomParent" className={CHAMP} {...register('nomParent')} />
          {errors.nomParent && <p className="mt-1 text-xs text-red-600">{errors.nomParent.message}</p>}
        </div>
        <div>
          <label htmlFor="telephoneParent" className="mb-1 block text-sm font-medium text-gray-700">
            Téléphone du parent *
          </label>
          <input id="telephoneParent" className={CHAMP} {...register('telephoneParent')} />
          {errors.telephoneParent && (
            <p className="mt-1 text-xs text-red-600">{errors.telephoneParent.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <label htmlFor="adresse" className="mb-1 block text-sm font-medium text-gray-700">Adresse *</label>
          <input id="adresse" className={CHAMP} {...register('adresse')} />
          {errors.adresse && <p className="mt-1 text-xs text-red-600">{errors.adresse.message}</p>}
        </div>

        <div className="col-span-2">
          <label htmlFor="photo" className="mb-1 block text-sm font-medium text-gray-700">
            Photo (optionnelle, JPG/PNG/WEBP, 2 Mo max)
          </label>
          <input
            id="photo"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-800"
            onChange={(e) => void onChoixPhoto(e.target.files?.[0])}
          />
          {erreurPhoto && <p className="mt-1 text-xs text-red-600">{erreurPhoto}</p>}
        </div>

        {erreurServeur && (
          <p className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreurServeur}</p>
        )}

        <div className="col-span-2 flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="secondaire" onClick={onFermer}>Annuler</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
