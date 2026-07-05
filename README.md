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

## Scripts utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Application en mode développement |
| `npm run build` | Build de production (main + preload + renderer) |
| `npm run typecheck` | Vérification TypeScript stricte |
| `npm run db:migrate` | Nouvelle migration Prisma |
| `npm run db:seed` | Données de base (sans démo) |
| `npm run dist:win` | Installateur Windows (NSIS) |

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
- [ ] Étape 7 — Module Inscriptions
- [ ] Étape 8 — Module Paiements
- [ ] Étape 9 — Reçus PDF
- [ ] Étape 10 — Impayés
- [ ] Étape 11 — Rapports (PDF / Excel)
- [ ] Étape 12 — Utilisateurs & rôles (administration)
- [ ] Étape 13 — Journal d'activité (interface)
- [ ] Étape 14 — Sauvegardes (interface restauration / export)
- [ ] Étape 15 — Paramètres de l'école & installateur Windows
