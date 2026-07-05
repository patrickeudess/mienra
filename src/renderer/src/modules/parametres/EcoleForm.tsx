/**
 * Formulaire d'identité de l'établissement (nom, adresse, téléphone, email,
 * code des matricules, logo). Utilisé par l'assistant de bienvenue au
 * premier lancement et par la page Paramètres.
 */
import { useEffect, useState } from 'react'
import type { EcoleInfo, PhotoInput } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { fichierVersPhoto } from '@/lib/fichiers'

interface EcoleFormProps {
  /** Valeurs actuelles (null tant que le chargement n'est pas terminé). */
  ecole: EcoleInfo | null
  /** Libellé du bouton d'enregistrement. */
  libelleBouton?: string
  /** Appelé après un enregistrement réussi. */
  onEnregistre: () => void
}

const CHAMP =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export function EcoleForm({ ecole, libelleBouton = 'Enregistrer', onEnregistre }: EcoleFormProps): JSX.Element {
  const { utilisateur } = useAuth()
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('MIENRA')
  const [logo, setLogo] = useState<PhotoInput | undefined>(undefined)
  const [apercuLogo, setApercuLogo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    if (!ecole) return
    setNom(ecole.nom === 'Mon École' && !ecole.configuree ? '' : ecole.nom)
    setAdresse(ecole.adresse)
    setTelephone(ecole.telephone)
    setEmail(ecole.email)
    setCode(ecole.code)
    setApercuLogo(ecole.logoDataUrl)
    setLogo(undefined)
  }, [ecole])

  const onChoixLogo = async (fichier: File | undefined): Promise<void> => {
    setErreur(null)
    if (!fichier) return
    const photo = await fichierVersPhoto(fichier)
    if (!photo) {
      setErreur('Format de logo accepté : JPG, PNG ou WEBP.')
      return
    }
    setLogo(photo)
    setApercuLogo(
      `data:image/${photo.extension === 'jpg' ? 'jpeg' : photo.extension};base64,${photo.dataBase64}`
    )
  }

  const enregistrer = async (): Promise<void> => {
    if (!utilisateur) return
    setErreur(null)
    setEnCours(true)
    const resultat = await window.api.parametres.ecoleUpdate(
      { nom, adresse, telephone, email, code, logo },
      utilisateur.id
    )
    setEnCours(false)
    if (!resultat.ok) {
      setErreur(resultat.erreur)
      return
    }
    onEnregistre()
  }

  return (
    <div>
      <div className="flex flex-wrap items-start gap-5">
        {/* Logo */}
        <div className="shrink-0">
          {apercuLogo ? (
            <img
              src={apercuLogo}
              alt="Logo de l'école"
              className="h-20 w-20 rounded-xl object-contain ring-1 ring-gray-200"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-accent-500 text-2xl font-bold text-white">
              {(nom || 'M')[0].toUpperCase()}
            </div>
          )}
          <label className="mt-2 block cursor-pointer text-center text-xs font-medium text-primary-700 hover:underline">
            {apercuLogo ? 'Changer le logo' : 'Ajouter le logo'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => void onChoixLogo(e.target.files?.[0] ?? undefined)}
            />
          </label>
        </div>

        {/* Champs */}
        <div className="grid min-w-64 flex-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nomEcole" className="mb-1 block text-sm font-medium text-gray-700">
              Nom de l&apos;établissement *
            </label>
            <input
              id="nomEcole"
              className={CHAMP}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Groupe Scolaire Les Génies"
            />
          </div>
          <div>
            <label htmlFor="adresseEcole" className="mb-1 block text-sm font-medium text-gray-700">
              Adresse
            </label>
            <input id="adresseEcole" className={CHAMP} value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </div>
          <div>
            <label htmlFor="telEcole" className="mb-1 block text-sm font-medium text-gray-700">
              Téléphone
            </label>
            <input id="telEcole" className={CHAMP} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="emailEcole" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="emailEcole"
              type="email"
              className={CHAMP}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="codeEcole" className="mb-1 block text-sm font-medium text-gray-700">
              Code de l&apos;établissement *
            </label>
            <input
              id="codeEcole"
              className={`${CHAMP} font-mono uppercase`}
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <p className="mt-1 text-xs text-gray-500">
              Préfixe des matricules : {code || 'CODE'}-2026-0001
            </p>
          </div>
        </div>
      </div>

      {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      <div className="mt-4 flex justify-end">
        <Button onClick={() => void enregistrer()} disabled={!ecole || nom.trim() === '' || enCours}>
          {enCours ? 'Enregistrement…' : libelleBouton}
        </Button>
      </div>
    </div>
  )
}
