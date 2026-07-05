/**
 * Types et schémas partagés entre le processus principal (Electron) et le
 * renderer (React). SQLite ne supportant pas les enums Prisma, les valeurs
 * fixes sont définies ici et validées avec Zod.
 */
import { z } from 'zod'

// --------------------------------------------------------------------------
// Rôles utilisateurs
// --------------------------------------------------------------------------
export const ROLES = ['ADMINISTRATEUR', 'DIRECTEUR', 'SECRETAIRE_COMPTABLE'] as const
export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRATEUR: 'Administrateur',
  DIRECTEUR: 'Directeur',
  SECRETAIRE_COMPTABLE: 'Secrétaire / Comptable'
}

// --------------------------------------------------------------------------
// Modes de paiement
// --------------------------------------------------------------------------
export const MODES_PAIEMENT = ['ESPECES', 'MOBILE_MONEY', 'BANQUE', 'CHEQUE'] as const
export const modePaiementSchema = z.enum(MODES_PAIEMENT)
export type ModePaiement = z.infer<typeof modePaiementSchema>

export const MODE_PAIEMENT_LABELS: Record<ModePaiement, string> = {
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  BANQUE: 'Banque',
  CHEQUE: 'Chèque'
}

// --------------------------------------------------------------------------
// Niveaux scolaires
// --------------------------------------------------------------------------
export const NIVEAUX = ['MATERNELLE', 'PRIMAIRE', 'COLLEGE', 'LYCEE'] as const
export const niveauSchema = z.enum(NIVEAUX)
export type Niveau = z.infer<typeof niveauSchema>

export const NIVEAU_LABELS: Record<Niveau, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  COLLEGE: 'Collège',
  LYCEE: 'Lycée'
}

// --------------------------------------------------------------------------
// Actions du journal d'activité
// --------------------------------------------------------------------------
export const ACTIONS_JOURNAL = [
  'CONNEXION',
  'DECONNEXION',
  'CREATION_ELEVE',
  'MODIFICATION_ELEVE',
  'SUPPRESSION_ELEVE',
  'INSCRIPTION',
  'PAIEMENT',
  'IMPRESSION_RECU',
  'SAUVEGARDE',
  'RESTAURATION'
] as const
export type ActionJournal = (typeof ACTIONS_JOURNAL)[number]

// --------------------------------------------------------------------------
// Authentification
// --------------------------------------------------------------------------
export const loginSchema = z.object({
  identifiant: z.string().min(1, "L'identifiant est requis"),
  motDePasse: z.string().min(1, 'Le mot de passe est requis')
})
export type LoginInput = z.infer<typeof loginSchema>

/** Utilisateur connecté, sans le hash du mot de passe. */
export interface UtilisateurSession {
  id: number
  nom: string
  identifiant: string
  role: Role
}

export type LoginResult =
  | { ok: true; utilisateur: UtilisateurSession }
  | { ok: false; erreur: string }

// --------------------------------------------------------------------------
// Tableau de bord
// --------------------------------------------------------------------------
/** Point du graphique mensuel des encaissements. */
export interface EncaissementMensuel {
  /** Mois au format "2026-01" */
  mois: string
  /** Libellé court, ex. "Janv." */
  libelle: string
  montant: number
}

export interface DashboardStats {
  anneeScolaire: string | null
  totalEleves: number
  totalInscriptions: number
  montantAttendu: number
  montantEncaisse: number
  soldeRestant: number
  elevesImpayes: number
  recettesDuJour: number
  encaissementsMensuels: EncaissementMensuel[]
}
