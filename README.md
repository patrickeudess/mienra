# MIENRA — Logiciel de gestion scolaire

Application de bureau **100 % offline** pour la gestion des inscriptions, des
paiements, des reçus et des rapports financiers des établissements scolaires
(primaire, collège, lycée), conçue pour la Côte d'Ivoire.

## Stack technique

| Couche | Technologie |
|---|---|
| Interface | React 18 + TypeScript strict + Tailwind CSS |
| Application desktop | Electron (electron-vite) |
| Base de données | SQLite locale via Prisma |
| Formulaires | React Hook Form + Zod |
| PDF / Excel | pdf-lib / ExcelJS |
| Graphiques | Recharts |
| Installateur Windows | Electron Builder (NSIS) |

## Architecture

```
mienra/
├── prisma/
│   ├── schema.prisma        # Schéma de la base (SQLite)
│   ├── migrations/          # Migrations versionnées
│   └── seed.ts              # Données initiales (+ démo avec SEED_DEMO=1)
├── src/
│   ├── main/                # Processus principal Electron (Node.js)
│   │   ├── index.ts         # Fenêtre, cycle de vie, sauvegarde à la fermeture
│   │   ├── database/        # Client Prisma + sauvegardes automatiques
│   │   ├── services/        # Services transverses (journal d'activité)
│   │   └── ipc/             # Handlers IPC, un fichier par module
│   ├── preload/             # Pont sécurisé contextBridge (window.api)
│   ├── shared/              # Types, schémas Zod et canaux IPC partagés
│   └── renderer/            # Interface React
│       └── src/
│           ├── components/  # Composants réutilisables (layout, ui)
│           ├── context/     # Contexte d'authentification
│           ├── lib/         # Utilitaires (formatage FCFA…)
│           └── modules/     # Un dossier par module métier
│               ├── auth/
│               ├── dashboard/
│               └── …        # eleves, inscriptions, paiements, recus,
│                            # rapports, utilisateurs, parametres,
│                            # sauvegardes, journal (étapes suivantes)
├── electron.vite.config.ts
├── electron-builder.yml     # Installateur Windows
└── tailwind.config.js       # Palette MIENRA (bleu foncé, vert, gris clair)
```

**Principe de sécurité** : le renderer (React) n'a aucun accès à Node ni à la
base. Toutes les opérations passent par des canaux IPC typés exposés dans le
preload (`window.api`). Les mots de passe sont hachés avec bcrypt et ne
quittent jamais le processus principal.

## Démarrage (développement)

```bash
npm install
npx prisma migrate dev      # crée prisma/dev.db
npm run db:seed:demo        # utilisateurs + classes + données de démonstration
npm run dev                 # lance Electron + rechargement à chaud
```

Comptes créés par le seed (mots de passe à changer en production) :

| Identifiant | Mot de passe | Rôle |
|---|---|---|
| `admin` | `admin123` | Administrateur |
| `directeur` | `directeur123` | Directeur |
| `secretaire` | `secretaire123` | Secrétaire / Comptable |

## Tester l'application dans un navigateur (sans Electron)

```bash
npm run build      # compile l'interface
npm run test:app   # http://localhost:5199 (version compilée)

npm run test:app:dev   # http://localhost:5200 (rechargement automatique)
```

Le mode `test:app:dev` recharge tout automatiquement : les modifications de
l'interface s'affichent instantanément dans la page ouverte (HMR de Vite,
sans F5) et le serveur des handlers réels redémarre seul quand le code du
processus principal change (`tsx watch`).

Le serveur de test (`dev/serveur-test.ts`) exécute les **vrais handlers IPC**
et la **vraie base** `prisma/dev.db` ; seul le module `electron` est remplacé
par un stub (`dev/electron-stub.ts`, alias dans `dev/tsconfig.json`). Le pont
`window.api` est généré automatiquement depuis la carte des canaux IPC :
l'application complète se pilote alors depuis un navigateur — pratique pour
tester ou faire une démonstration sans installer quoi que ce soit.

## Scripts utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Application en mode développement |
| `npm run build` | Build de production (main + preload + renderer) |
| `npm run typecheck` | Vérification TypeScript stricte |
| `npm run db:migrate` | Nouvelle migration Prisma |
| `npm run db:seed` | Données de base (sans démo) |
| `npm run dist:win` | Installateur Windows (NSIS) — génère d'abord la base modèle |

## Installateur Windows

`npm run dist:win` enchaîne :

1. `db:template` — crée `resources/mienra-template.db` (migrations + comptes,
   année scolaire et classes de départ) ;
2. build de production ;
3. Electron Builder (NSIS). La base modèle est embarquée en ressource et
   copiée dans le dossier `userData` de la machine au premier lancement.

## Multi-établissement

Chaque école qui installe MIENRA personnalise le logiciel à son image :

- **Assistant de bienvenue** au premier lancement : l'administrateur
  renseigne le nom, l'adresse, le téléphone, l'email, le **code de
  l'établissement** et téléverse le **logo** ;
- ces informations habillent l'en-tête des **reçus PDF**, des **rapports
  PDF et Excel** et la barre latérale ;
- le code sert de préfixe aux **matricules** (ex. `GSM-2026-0001`), avec
  une numérotation propre à chaque établissement ;
- tout reste modifiable dans **Paramètres**.

## Interface responsive

La barre latérale se replie en mode icônes (avec info-bulles) sous 1024 px
de large ; les grilles de cartes s'adaptent et les tableaux défilent
horizontalement dans leur conteneur. Fenêtre minimale : 800 × 600.

## Sauvegardes automatiques

À chaque fermeture de l'application, une copie horodatée de la base est créée
dans le dossier `backups/` (dossier `userData` en production). Les **dix
dernières** sauvegardes sont conservées. La restauration et l'export seront
pilotables depuis le module Sauvegardes.

## Feuille de route

- [x] Étape 1 — Architecture du projet
- [x] Étape 2 — Initialisation Electron / React / TypeScript / Tailwind / SQLite / Prisma
- [x] Étape 3 — Configuration de la base de données
- [x] Étape 4 — Premières tables (utilisateurs, années, classes, élèves, inscriptions, paiements, journal)
- [x] Étape 5 — Tableau de bord + authentification
- [x] Étape 6 — Module Élèves (liste, recherche, fiche, matricule automatique, photo)
- [x] Étape 7 — Module Inscriptions (classe, année, montants, total automatique)
- [x] Étape 8 — Module Paiements (versements multiples, reçu automatique, historique)
- [x] Étape 9 — Reçus PDF (génération automatique, QR code, impression en un clic)
- [x] Étape 10 — Impayés (pourcentage payé, filtres classe / niveau / année)
- [x] Étape 11 — Rapports (8 rapports, aperçu, exports PDF / Excel)
- [x] Étape 12 — Utilisateurs & rôles (création, activation, mots de passe, garde-fous)
- [x] Étape 13 — Journal d'activité (consultation filtrable, accès admin/directeur)
- [x] Étape 14 — Sauvegardes (manuelle, restauration avec filet de sécurité, export)
- [x] Étape 15 — Paramètres (école, logo, années, classes), responsive & installateur Windows
