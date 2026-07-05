/**
 * Contexte d'authentification : conserve l'utilisateur connecté pendant la
 * session de l'application (aucune persistance : à la réouverture du
 * logiciel, une nouvelle connexion est demandée).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { LoginInput, UtilisateurSession } from '@shared/types'

interface AuthContextValue {
  utilisateur: UtilisateurSession | null
  /** Tente la connexion ; retourne un message d'erreur ou null si succès. */
  seConnecter: (input: LoginInput) => Promise<string | null>
  seDeconnecter: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [utilisateur, setUtilisateur] = useState<UtilisateurSession | null>(null)

  const seConnecter = useCallback(async (input: LoginInput): Promise<string | null> => {
    const resultat = await window.api.auth.login(input)
    if (!resultat.ok) return resultat.erreur
    setUtilisateur(resultat.utilisateur)
    return null
  }, [])

  const seDeconnecter = useCallback(async (): Promise<void> => {
    if (utilisateur) await window.api.auth.logout(utilisateur.id)
    setUtilisateur(null)
  }, [utilisateur])

  const value = useMemo(
    () => ({ utilisateur, seConnecter, seDeconnecter }),
    [utilisateur, seConnecter, seDeconnecter]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Hook d'accès au contexte d'authentification. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
