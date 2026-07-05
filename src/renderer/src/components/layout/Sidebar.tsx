/**
 * Barre latérale de navigation : un lien par module.
 * Les modules non encore développés sont visibles mais mènent à une page
 * "en construction", pour donner la vision complète du logiciel.
 */
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS } from '@shared/types'

interface NavItem {
  chemin: string
  libelle: string
  /** Petit pictogramme texte (pas de librairie d'icônes pour rester léger). */
  icone: string
}

const NAV_ITEMS: NavItem[] = [
  { chemin: '/', libelle: 'Tableau de bord', icone: '▦' },
  { chemin: '/eleves', libelle: 'Élèves', icone: '👤' },
  { chemin: '/inscriptions', libelle: 'Inscriptions', icone: '✎' },
  { chemin: '/paiements', libelle: 'Paiements', icone: '💰' },
  { chemin: '/recus', libelle: 'Reçus', icone: '🧾' },
  { chemin: '/impayes', libelle: 'Impayés', icone: '⚠' },
  { chemin: '/rapports', libelle: 'Rapports', icone: '📊' },
  { chemin: '/utilisateurs', libelle: 'Utilisateurs', icone: '👥' },
  { chemin: '/journal', libelle: "Journal d'activité", icone: '🕘' },
  { chemin: '/sauvegardes', libelle: 'Sauvegardes', icone: '💾' },
  { chemin: '/parametres', libelle: 'Paramètres', icone: '⚙' }
]

export function Sidebar(): JSX.Element {
  const { utilisateur, seDeconnecter } = useAuth()

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-primary-900 text-white">
      {/* Logo / nom de l'application */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-lg font-bold">
          M
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">MIENRA</p>
          <p className="text-xs text-primary-200">Gestion scolaire</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.chemin}
            to={item.chemin}
            end={item.chemin === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-700 font-semibold text-white'
                  : 'text-primary-100 hover:bg-primary-800 hover:text-white'
              }`
            }
          >
            <span aria-hidden className="w-5 text-center">
              {item.icone}
            </span>
            {item.libelle}
          </NavLink>
        ))}
      </nav>

      {/* Utilisateur connecté + déconnexion */}
      {utilisateur && (
        <div className="border-t border-primary-800 px-5 py-4">
          <p className="truncate text-sm font-semibold">{utilisateur.nom}</p>
          <p className="truncate text-xs text-primary-300">{ROLE_LABELS[utilisateur.role]}</p>
          <button
            type="button"
            onClick={() => void seDeconnecter()}
            className="mt-3 w-full rounded-lg bg-primary-800 px-3 py-1.5 text-sm text-primary-100 transition-colors hover:bg-primary-700 hover:text-white"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </aside>
  )
}
