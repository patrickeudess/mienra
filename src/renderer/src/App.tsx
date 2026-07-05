/**
 * Routage de l'application.
 * HashRouter : requis en production Electron (le renderer est chargé depuis
 * un fichier local, les routes "history" classiques ne fonctionnent pas).
 */
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/modules/auth/LoginPage'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { ElevesPage } from '@/modules/eleves/ElevesPage'
import { InscriptionsPage } from '@/modules/inscriptions/InscriptionsPage'
import { PaiementsPage } from '@/modules/paiements/PaiementsPage'
import { RecusPage } from '@/modules/recus/RecusPage'
import { ImpayesPage } from '@/modules/impayes/ImpayesPage'
import { RapportsPage } from '@/modules/rapports/RapportsPage'
import { UtilisateursPage } from '@/modules/utilisateurs/UtilisateursPage'
import { JournalPage } from '@/modules/journal/JournalPage'
import { SauvegardesPage } from '@/modules/sauvegardes/SauvegardesPage'
import { ParametresPage } from '@/modules/parametres/ParametresPage'

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
            <Route path="/impayes" element={<ImpayesPage />} />
            <Route path="/rapports" element={<RapportsPage />} />
            <Route path="/utilisateurs" element={<UtilisateursPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/sauvegardes" element={<SauvegardesPage />} />
            <Route path="/parametres" element={<ParametresPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
