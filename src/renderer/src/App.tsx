/**
 * Routage de l'application.
 * HashRouter : requis en production Electron (le renderer est chargé depuis
 * un fichier local, les routes "history" classiques ne fonctionnent pas).
 */
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { PagePlaceholder } from '@/components/ui/PagePlaceholder'
import { LoginPage } from '@/modules/auth/LoginPage'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { ElevesPage } from '@/modules/eleves/ElevesPage'
import { InscriptionsPage } from '@/modules/inscriptions/InscriptionsPage'
import { PaiementsPage } from '@/modules/paiements/PaiementsPage'
import { RecusPage } from '@/modules/recus/RecusPage'

export function App(): JSX.Element {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/eleves" element={<ElevesPage />} />
            <Route path="/inscriptions" element={<InscriptionsPage />} />
            <Route path="/paiements" element={<PaiementsPage />} />
            <Route path="/recus" element={<RecusPage />} />
            {/* Modules à venir — développés un par un aux prochaines étapes */}
            <Route path="/impayes" element={<PagePlaceholder titre="Impayés" />} />
            <Route path="/rapports" element={<PagePlaceholder titre="Rapports" />} />
            <Route path="/utilisateurs" element={<PagePlaceholder titre="Utilisateurs" />} />
            <Route path="/journal" element={<PagePlaceholder titre="Journal d'activité" />} />
            <Route path="/sauvegardes" element={<PagePlaceholder titre="Sauvegardes" />} />
            <Route path="/parametres" element={<PagePlaceholder titre="Paramètres" />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
