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
// Élèves
// --------------------------------------------------------------------------
export const SEXES = ['M', 'F'] as const
export const sexeSchema = z.enum(SEXES)
export type Sexe = z.infer<typeof sexeSchema>

export const SEXE_LABELS: Record<Sexe, string> = {
  M: 'Masculin',
  F: 'Féminin'
}

/** Photo transmise du renderer vers le main (fichier encodé en base64). */
export const photoInputSchema = z.object({
  dataBase64: z.string().min(1),
  extension: z.enum(['jpg', 'jpeg', 'png', 'webp'])
})
export type PhotoInput = z.infer<typeof photoInputSchema>

/** Données de la fiche élève (création et modification). */
export const eleveInputSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis'),
  prenom: z.string().trim().min(1, 'Le prénom est requis'),
  sexe: sexeSchema,
  dateNaissance: z
    .string()
    .min(1, 'La date de naissance est requise')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Date invalide'),
  lieuNaissance: z.string().trim().min(1, 'Le lieu de naissance est requis'),
  nationalite: z.string().trim().min(1, 'La nationalité est requise'),
  telephoneParent: z.string().trim().min(8, 'Numéro de téléphone invalide'),
  nomParent: z.string().trim().min(1, 'Le nom du parent est requis'),
  adresse: z.string().trim().min(1, "L'adresse est requise"),
  /** Nouvelle photo (optionnelle). Ignorée si absente. */
  photo: photoInputSchema.optional()
})
export type EleveInput = z.infer<typeof eleveInputSchema>

/** Paramètres de la liste des élèves. */
export interface EleveListParams {
  recherche: string
  page: number // à partir de 1
  parPage: number
}

/** Ligne du tableau des élèves. */
export interface EleveListItem {
  id: number
  matricule: string
  nom: string
  prenom: string
  sexe: Sexe
  dateNaissance: string // ISO
  telephoneParent: string
  /** Classe de l'année scolaire active, si l'élève y est inscrit. */
  classe: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  parPage: number
}

/** Fiche élève complète (détail). */
export interface EleveDetail {
  id: number
  matricule: string
  nom: string
  prenom: string
  sexe: Sexe
  dateNaissance: string // ISO
  lieuNaissance: string
  nationalite: string
  telephoneParent: string
  nomParent: string
  adresse: string
  /** Photo en data-URL, prête à afficher (null si aucune). */
  photoDataUrl: string | null
  creeLe: string // ISO
  /** Historique des inscriptions (classe, année, montants). */
  inscriptions: {
    id: number
    classe: string
    anneeScolaire: string
    montantTotal: number
    montantPaye: number
  }[]
}

/** Résultat générique d'une opération d'écriture. */
export type OperationResult<T> = { ok: true; data: T } | { ok: false; erreur: string }

// --------------------------------------------------------------------------
// Référentiel (classes et années scolaires, pour les listes déroulantes)
// --------------------------------------------------------------------------
export interface ClasseRef {
  id: number
  nom: string
  niveau: Niveau
}

export interface AnneeScolaireRef {
  id: number
  libelle: string
  active: boolean
}

// --------------------------------------------------------------------------
// Inscriptions
// --------------------------------------------------------------------------
/** Montant en FCFA : entier positif ou nul (pas de centimes). */
const montantSchema = z
  .number({ invalid_type_error: 'Montant invalide' })
  .int('Montant invalide')
  .min(0, 'Le montant ne peut pas être négatif')

/** Données de création d'une inscription. Le total est calculé côté main. */
export const inscriptionInputSchema = z.object({
  eleveId: z.number().int().positive({ message: 'Choisissez un élève' }),
  classeId: z.number().int().positive({ message: 'Choisissez une classe' }),
  anneeScolaireId: z.number().int().positive({ message: 'Choisissez une année scolaire' }),
  scolarite: montantSchema,
  fraisInscription: montantSchema,
  autresFrais: montantSchema
})
export type InscriptionInput = z.infer<typeof inscriptionInputSchema>

/** Modification : seuls la classe et les montants peuvent changer. */
export const inscriptionUpdateSchema = inscriptionInputSchema.omit({
  eleveId: true,
  anneeScolaireId: true
})
export type InscriptionUpdate = z.infer<typeof inscriptionUpdateSchema>

export interface InscriptionListParams {
  recherche: string
  /** Filtre optionnel par classe / année scolaire (undefined = toutes). */
  classeId?: number
  anneeScolaireId?: number
  page: number
  parPage: number
}

/** Ligne du tableau des inscriptions. */
export interface InscriptionListItem {
  id: number
  eleveId: number
  matricule: string
  nomComplet: string
  classe: string
  anneeScolaire: string
  scolarite: number
  fraisInscription: number
  autresFrais: number
  montantTotal: number
  montantPaye: number
  reste: number
  dateInscription: string // ISO
}

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
