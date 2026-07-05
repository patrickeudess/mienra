/**
 * Gabarit principal : barre latérale fixe + zone de contenu défilante.
 * Protège l'accès : redirige vers /connexion si aucun utilisateur connecté,
 * et vers l'assistant de bienvenue tant que l'administrateur n'a pas
 * configuré l'identité de l'établissement.
 */
import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'

export function AppLayout(): JSX.Element {
  const { utilisateur } = useAuth()
  const [ecoleConfiguree, setEcoleConfiguree] = useState<boolean | null>(null)

  useEffect(() => {
    if (!utilisateur) return
    void window.api.parametres.ecoleGet().then((e) => setEcoleConfiguree(e.configuree))
  }, [utilisateur])

  if (!utilisateur) {
    return <Navigate to="/connexion" replace />
  }
  // Premier lancement : l'administrateur configure d'abord son établissement.
  if (ecoleConfiguree === false && utilisateur.role === 'ADMINISTRATEUR') {
    return <Navigate to="/bienvenue" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
