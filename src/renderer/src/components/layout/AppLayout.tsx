/**
 * Gabarit principal : barre latérale fixe + zone de contenu défilante.
 * Protège l'accès : redirige vers /connexion si aucun utilisateur connecté.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'

export function AppLayout(): JSX.Element {
  const { utilisateur } = useAuth()

  if (!utilisateur) {
    return <Navigate to="/connexion" replace />
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
