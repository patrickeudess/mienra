/**
 * Point d'entrée des handlers IPC : chaque module enregistre les siens.
 * Les modules suivants (élèves, inscriptions, paiements, ...) viendront
 * s'ajouter ici au fur et à mesure du développement.
 */
import { registerAuthHandlers } from './auth.handlers'
import { registerDashboardHandlers } from './dashboard.handlers'
import { registerElevesHandlers } from './eleves.handlers'
import { registerImpayesHandlers } from './impayes.handlers'
import { registerInscriptionsHandlers } from './inscriptions.handlers'
import { registerJournalHandlers } from './journal.handlers'
import { registerPaiementsHandlers } from './paiements.handlers'
import { registerParametresHandlers } from './parametres.handlers'
import { registerRapportsHandlers } from './rapports.handlers'
import { registerRecusHandlers } from './recus.handlers'
import { registerSauvegardesHandlers } from './sauvegardes.handlers'
import { registerReferentielHandlers } from './referentiel.handlers'
import { registerUtilisateursHandlers } from './utilisateurs.handlers'

export function registerIpcHandlers(): void {
  registerAuthHandlers()
  registerDashboardHandlers()
  registerElevesHandlers()
  registerReferentielHandlers()
  registerInscriptionsHandlers()
  registerPaiementsHandlers()
  registerRecusHandlers()
  registerImpayesHandlers()
  registerRapportsHandlers()
  registerUtilisateursHandlers()
  registerJournalHandlers()
  registerSauvegardesHandlers()
  registerParametresHandlers()
}
