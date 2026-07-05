/**
 * Assistant de première configuration : à la première connexion de
 * l'administrateur, chaque établissement renseigne son identité (nom,
 * adresse, téléphone, email, code des matricules, logo) — elle personnalise
 * les reçus, les rapports et les matricules de l'école.
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { EcoleInfo } from '@shared/types'
import { useAuth } from '@/context/AuthContext'
import { EcoleForm } from './EcoleForm'

export function BienvenuePage(): JSX.Element {
  const { utilisateur } = useAuth()
  const navigate = useNavigate()
  const [ecole, setEcole] = useState<EcoleInfo | null>(null)

  useEffect(() => {
    void window.api.parametres.ecoleGet().then(setEcole)
  }, [])

  if (!utilisateur) return <Navigate to="/connexion" replace />
  // Seul l'administrateur configure l'école ; déjà configurée = accueil.
  if (utilisateur.role !== 'ADMINISTRATEUR' || (ecole && ecole.configuree)) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-950 p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 text-2xl font-bold text-white">
            M
          </div>
          <h1 className="text-2xl font-bold text-primary-900">Bienvenue dans MIENRA</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configurez votre établissement : ces informations personnaliseront vos reçus, vos
            rapports et les matricules de vos élèves. Vous pourrez les modifier à tout moment dans
            Paramètres.
          </p>
        </div>

        <EcoleForm
          ecole={ecole}
          libelleBouton="Commencer avec MIENRA"
          onEnregistre={() => navigate('/', { replace: true })}
        />
      </div>
    </div>
  )
}
