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
  'EXPORT_RAPPORT',
  'GESTION_UTILISATEUR',
  'PARAMETRES',
  'SAUVEGARDE',
  'RESTAURATION'
] as const
export type ActionJournal = (typeof ACTIONS_JOURNAL)[number]

export const ACTION_JOURNAL_LABELS: Record<ActionJournal, string> = {
  CONNEXION: 'Connexion',
  DECONNEXION: 'Déconnexion',
  CREATION_ELEVE: 'Création d’un élève',
  MODIFICATION_ELEVE: 'Modification d’un élève',
  SUPPRESSION_ELEVE: 'Suppression d’un élève',
  INSCRIPTION: 'Inscription',
  PAIEMENT: 'Paiement',
  IMPRESSION_RECU: 'Impression d’un reçu',
  EXPORT_RAPPORT: 'Export d’un rapport',
  GESTION_UTILISATEUR: 'Gestion des utilisateurs',
  PARAMETRES: 'Paramètres',
  SAUVEGARDE: 'Sauvegarde',
  RESTAURATION: 'Restauration'
}

/** Paramètres de consultation du journal d'activité. */
export interface JournalParams {
  action?: ActionJournal
  utilisateurId?: number
  /** Bornes de période au format AAAA-MM-JJ (incluses). */
  du?: string
  au?: string
  page: number
  parPage: number
}

/** Entrée du journal d'activité affichée à l'écran. */
export interface JournalListItem {
  id: number
  date: string // ISO (date + heure)
  utilisateur: string | null
  action: ActionJournal
  details: string
  poste: string
}

/** Référence utilisateur pour les filtres (id + nom uniquement). */
export interface UtilisateurRef {
  id: number
  nom: string
}

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
// Gestion des utilisateurs (réservée à l'Administrateur)
// --------------------------------------------------------------------------
/** Création d'un compte utilisateur. */
export const utilisateurInputSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis'),
  identifiant: z
    .string()
    .trim()
    .min(3, "L'identifiant doit faire au moins 3 caractères")
    .regex(/^[a-z0-9._-]+$/i, "L'identifiant ne doit contenir que lettres, chiffres, . _ -"),
  motDePasse: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
  role: roleSchema
})
export type UtilisateurInput = z.infer<typeof utilisateurInputSchema>

/** Modification d'un compte : nom et rôle (l'identifiant ne change pas). */
export const utilisateurUpdateSchema = utilisateurInputSchema.omit({
  identifiant: true,
  motDePasse: true
})
export type UtilisateurUpdate = z.infer<typeof utilisateurUpdateSchema>

/** Réinitialisation du mot de passe par l'Administrateur. */
export const motDePasseSchema = z
  .string()
  .min(6, 'Le mot de passe doit faire au moins 6 caractères')

export interface UtilisateurListItem {
  id: number
  nom: string
  identifiant: string
  role: Role
  actif: boolean
  creeLe: string // ISO
}

// --------------------------------------------------------------------------
// Paramètres (école, années scolaires, classes)
// --------------------------------------------------------------------------
/**
 * Informations de l'établissement (en-tête des reçus et rapports).
 * Chaque école qui installe MIENRA renseigne sa propre identité.
 */
export const ecoleInputSchema = z.object({
  nom: z.string().trim().min(1, "Le nom de l'école est requis"),
  adresse: z.string().trim(),
  telephone: z.string().trim(),
  email: z
    .string()
    .trim()
    .email('Adresse email invalide')
    .or(z.literal(''))
    .default(''),
  /** Code de l'établissement : préfixe des matricules (ex. GSM-2026-0001). */
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, 'Code : 2 à 8 lettres majuscules ou chiffres (ex. GSM)'),
  /** Nouveau logo (optionnel) ; l'actuel est conservé si absent. */
  logo: photoInputSchema.optional()
})
export type EcoleInput = z.infer<typeof ecoleInputSchema>

export interface EcoleInfo {
  nom: string
  adresse: string
  telephone: string
  email: string
  code: string
  /** Logo en data-URL, prêt à afficher (null si aucun). */
  logoDataUrl: string | null
  /** Faux tant que l'assistant de première configuration n'a pas été validé. */
  configuree: boolean
}

/** Nouvelle année scolaire : "2026-2027" (années consécutives). */
export const anneeScolaireInputSchema = z
  .object({
    libelle: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027')
  })
  .refine(
    (v) => {
      const [debut, fin] = v.libelle.split('-').map(Number)
      return fin === debut + 1
    },
    { message: 'Les deux années doivent être consécutives (ex. 2026-2027)' }
  )
export type AnneeScolaireInput = z.infer<typeof anneeScolaireInputSchema>

/** Création / modification d'une classe. */
export const classeInputSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom de la classe est requis'),
  niveau: niveauSchema,
  ordre: z.number().int().min(0).default(0)
})
export type ClasseInput = z.infer<typeof classeInputSchema>

/** Classe avec son nombre d'inscriptions (pour autoriser la suppression). */
export interface ClasseDetail extends ClasseRef {
  ordre: number
  nbInscriptions: number
}

// --------------------------------------------------------------------------
// Sauvegardes
// --------------------------------------------------------------------------
export interface SauvegardeInfo {
  nom: string
  date: string // ISO
  taille: number // octets
}

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
// Paiements
// --------------------------------------------------------------------------
/** Données d'encaissement d'un versement. */
export const paiementInputSchema = z.object({
  inscriptionId: z.number().int().positive({ message: 'Choisissez une inscription' }),
  montant: z
    .number({ invalid_type_error: 'Montant invalide' })
    .int('Montant invalide')
    .positive('Le montant doit être supérieur à zéro'),
  mode: modePaiementSchema
})
export type PaiementInput = z.infer<typeof paiementInputSchema>

export interface PaiementListParams {
  recherche: string
  mode?: ModePaiement
  anneeScolaireId?: number
  page: number
  parPage: number
}

/** Ligne du tableau des paiements. */
export interface PaiementListItem {
  id: number
  numeroRecu: string
  inscriptionId: number
  matricule: string
  nomComplet: string
  classe: string
  anneeScolaire: string
  montant: number
  mode: ModePaiement
  caissier: string
  datePaiement: string // ISO
}

/** Historique complet des versements d'une inscription. */
export interface HistoriquePaiements {
  inscriptionId: number
  matricule: string
  nomComplet: string
  classe: string
  anneeScolaire: string
  montantTotal: number
  montantPaye: number
  reste: number
  versements: {
    id: number
    numeroRecu: string
    montant: number
    mode: ModePaiement
    caissier: string
    datePaiement: string // ISO
  }[]
}

// --------------------------------------------------------------------------
// Impayés
// --------------------------------------------------------------------------
export interface ImpayesParams {
  recherche: string
  classeId?: number
  niveau?: Niveau
  anneeScolaireId?: number
  page: number
  parPage: number
}

/** Ligne du tableau des impayés. */
export interface ImpayeListItem {
  inscriptionId: number
  matricule: string
  nomComplet: string
  classe: string
  niveau: Niveau
  anneeScolaire: string
  montantAttendu: number
  montantPaye: number
  reste: number
  /** Pourcentage payé, arrondi (0 à 99 pour un impayé). */
  pourcentagePaye: number
}

/** Résultat de la page Impayés : lignes paginées + totaux des filtres. */
export interface ImpayesResult extends Paginated<ImpayeListItem> {
  totaux: {
    montantAttendu: number
    montantPaye: number
    reste: number
  }
}

// --------------------------------------------------------------------------
// Rapports
// --------------------------------------------------------------------------
export const TYPES_RAPPORT = [
  'JOURNALIER',
  'MENSUEL',
  'ANNUEL',
  'PAR_CLASSE',
  'PAR_NIVEAU',
  'MOBILE_MONEY',
  'ESPECES',
  'IMPAYES'
] as const
export type TypeRapport = (typeof TYPES_RAPPORT)[number]

export const TYPE_RAPPORT_LABELS: Record<TypeRapport, string> = {
  JOURNALIER: 'Rapport journalier',
  MENSUEL: 'Rapport mensuel',
  ANNUEL: 'Rapport annuel',
  PAR_CLASSE: 'Rapport par classe',
  PAR_NIVEAU: 'Rapport par niveau',
  MOBILE_MONEY: 'Paiements Mobile Money',
  ESPECES: 'Paiements espèces',
  IMPAYES: 'Rapport des impayés'
}

/** Paramètres d'un rapport ; les champs requis dépendent du type. */
export const rapportParamsSchema = z.object({
  type: z.enum(TYPES_RAPPORT),
  /** JOURNALIER : jour au format AAAA-MM-JJ. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').optional(),
  /** MENSUEL : mois au format AAAA-MM. */
  mois: z.string().regex(/^\d{4}-\d{2}$/, 'Mois invalide').optional(),
  anneeScolaireId: z.number().int().positive().optional(),
  classeId: z.number().int().positive().optional(),
  niveau: niveauSchema.optional()
})
export type RapportParams = z.infer<typeof rapportParamsSchema>

/** Ligne d'un rapport de paiements. */
export interface RapportLignePaiement {
  numeroRecu: string
  date: string // ISO
  matricule: string
  nomComplet: string
  classe: string
  mode: ModePaiement
  montant: number
}

/** Ligne d'un rapport des impayés. */
export interface RapportLigneImpaye {
  matricule: string
  nomComplet: string
  classe: string
  montantAttendu: number
  montantPaye: number
  reste: number
  pourcentagePaye: number
}

export interface RapportPaiementsData {
  famille: 'PAIEMENTS'
  type: TypeRapport
  titre: string
  sousTitre: string
  genereLe: string // ISO
  lignes: RapportLignePaiement[]
  totaux: {
    nombre: number
    montant: number
    parMode: { mode: ModePaiement; montant: number }[]
  }
}

export interface RapportImpayesData {
  famille: 'IMPAYES'
  type: TypeRapport
  titre: string
  sousTitre: string
  genereLe: string // ISO
  lignes: RapportLigneImpaye[]
  totaux: {
    nombre: number
    montantAttendu: number
    montantPaye: number
    reste: number
  }
}

export type RapportData = RapportPaiementsData | RapportImpayesData

export type FormatExport = 'pdf' | 'excel'

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
