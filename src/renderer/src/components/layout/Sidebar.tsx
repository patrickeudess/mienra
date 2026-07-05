/**
 * Barre latérale de navigation : un lien par module, filtré selon le rôle.
 * Responsive : en dessous de 1024 px de large (lg), elle se replie en mode
 * icônes avec info-bulles pour laisser la place au contenu.
 */
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS, type Role } from '@shared/types'

interface NavItem {
  chemin: string
  libelle: string
  /** Petit pictogramme texte (pas de librairie d'icônes pour rester léger). */
  icone: string
  /** Rôles autorisés ; absent = visible par tous. */
  roles?: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { chemin: '/', libelle: 'Tableau de bord', icone: '▦' },
  { chemin: '/eleves', libelle: 'Élèves', icone: '👤' },
  { chemin: '/inscriptions', libelle: 'Inscriptions', icone: '✎' },
  { chemin: '/paiements', libelle: 'Paiements', icone: '💰' },
  { chemin: '/recus', libelle: 'Reçus', icone: '🧾' },
  { chemin: '/impayes', libelle: 'Impayés', icone: '⚠' },
  { chemin: '/rapports', libelle: 'Rapports', icone: '📊' },
  { chemin: '/utilisateurs', libelle: 'Utilisateurs', icone: '👥', roles: ['ADMINISTRATEUR'] },
  {
    chemin: '/journal',
    libelle: "Journal d'activité",
    icone: '🕘',
    roles: ['ADMINISTRATEUR', 'DIRECTEUR']
  },
  { chemin: '/sauvegardes', libelle: 'Sauvegardes', icone: '💾', roles: ['ADMINISTRATEUR'] },
  { chemin: '/parametres', libelle: 'Paramètres', icone: '⚙', roles: ['ADMINISTRATEUR'] }
]

export function Sidebar(): JSX.Element {
  const { utilisateur, seDeconnecter } = useAuth()

  return (
    <aside className="flex h-screen w-16 shrink-0 flex-col bg-primary-900 text-white lg:w-60">
      {/* Logo / nom de l'application */}
      <div className="flex items-center justify-center gap-2 px-2 py-5 lg:justify-start lg:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-lg font-bold">
          M
        </div>
        <div className="hidden lg:block">
          <p className="text-lg font-bold leading-tight">MIENRA</p>
          <p className="text-xs text-primary-200">Gestion scolaire</p>
        </div>
      </div>

      {/* Navigation — filtrée selon le rôle de l'utilisateur connecté */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 lg:px-3">
        {NAV_ITEMS.filter(
          (item) => !item.roles || (utilisateur && item.roles.includes(utilisateur.role))
        ).map((item) => (
          <NavLink
            key={item.chemin}
            to={item.chemin}
            end={item.chemin === '/'}
            title={item.libelle}
            className={({ isActive }) =>
              `flex items-center justify-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors lg:justify-start lg:px-3 ${
                isActive
                  ? 'bg-primary-700 font-semibold text-white'
                  : 'text-primary-100 hover:bg-primary-800 hover:text-white'
              }`
            }
          >
            <span aria-hidden className="w-5 text-center">
              {item.icone}
            </span>
            <span className="hidden lg:inline">{item.libelle}</span>
          </NavLink>
        ))}
      </nav>

      {/* Utilisateur connecté + déconnexion */}
      {utilisateur && (
        <div className="border-t border-primary-800 px-2 py-4 lg:px-5">
          <div className="hidden lg:block">
            <p className="truncate text-sm font-semibold">{utilisateur.nom}</p>
            <p className="truncate text-xs text-primary-300">{ROLE_LABELS[utilisateur.role]}</p>
          </div>
          <button
            type="button"
            onClick={() => void seDeconnecter()}
            title="Se déconnecter"
            className="mt-0 w-full rounded-lg bg-primary-800 px-2 py-1.5 text-sm text-primary-100 transition-colors hover:bg-primary-700 hover:text-white lg:mt-3 lg:px-3"
          >
            <span className="lg:hidden" aria-hidden>
              ⎋
            </span>
            <span className="hidden lg:inline">Se déconnecter</span>
          </button>
        </div>
      )}
    </aside>
  )
}
