/**
 * Page de connexion : formulaire React Hook Form + validation Zod.
 * La vérification du mot de passe se fait dans le processus principal.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { loginSchema, type LoginInput } from '@shared/types'
import { useAuth } from '@/context/AuthContext'

export function LoginPage(): JSX.Element {
  const { seConnecter } = useAuth()
  const navigate = useNavigate()
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (input: LoginInput): Promise<void> => {
    setErreurServeur(null)
    const erreur = await seConnecter(input)
    if (erreur) {
      setErreurServeur(erreur)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex h-screen items-center justify-center bg-primary-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        {/* En-tête */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 text-2xl font-bold text-white">
            M
          </div>
          <h1 className="text-2xl font-bold text-primary-900">MIENRA</h1>
          <p className="text-sm text-gray-500">Logiciel de gestion scolaire</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="identifiant" className="mb-1 block text-sm font-medium text-gray-700">
              Identifiant
            </label>
            <input
              id="identifiant"
              type="text"
              autoComplete="username"
              autoFocus
              {...register('identifiant')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            {errors.identifiant && (
              <p className="mt-1 text-xs text-red-600">{errors.identifiant.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="motDePasse" className="mb-1 block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="current-password"
              {...register('motDePasse')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            {errors.motDePasse && (
              <p className="mt-1 text-xs text-red-600">{errors.motDePasse.message}</p>
            )}
          </div>

          {erreurServeur && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreurServeur}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-primary-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
