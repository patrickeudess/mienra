# MIENRA Web - EPV Mienrassou

Application web de gestion scolaire pour **EPV Mienrassou**. Elle fonctionne dans le navigateur, est publiée sur GitHub Pages et synchronise les données avec Supabase lorsque l'authentification est configurée.

Lien public : https://patrickeudess.github.io/mienra/

## Fonctionnalités principales

- Tableau de bord financier et effectifs par classe.
- Gestion des élèves avec matricule unique.
- Classes et frais officiels : 70 000 FCFA de la maternelle au CM1, 75 000 FCFA en CM2.
- Paiements par versements successifs jusqu'au solde.
- Suivi des paiements : payé, reste à payer, statut, payé par, historique par élève.
- Rappels **WhatsApp** aux parents d'élèves ayant un solde restant (message pré-rempli avec l'élève, le reste à payer et l'école ; simple lien wa.me, aucune donnée envoyée à un serveur).
- Reçus imprimables en deux exemplaires sur une feuille A4.
- Numéros de reçus sécurisés par compteur serveur Supabase quand le mode relationnel est actif.
- Rapports complets, vues SQL relationnelles et exports CSV.
- Utilisateurs, rôles, verrouillage d'accès et journal des actions.
- Sauvegarde JSON complète avec rappel périodique.
- Page **État système** pour contrôler Supabase, la session, les reçus, les sauvegardes et l'état relationnel.
- **Mode production** pour bloquer les actions dangereuses après validation de l'application.
- **Application installable et utilisable hors ligne (PWA)** : après une première visite en ligne, l'app se charge sans réseau ; la police **et le SDK Supabase** sont hébergés localement (aucune dépendance CDN externe au chargement).

## Fonctionnement hors ligne (PWA)

L'application est une **PWA** : elle peut être installée (icône sur téléphone ou ordinateur) et fonctionne hors ligne après une première ouverture en ligne.

- `sw.js` (service worker) met en cache la coquille de l'application (HTML, CSS, JS, police) pour un chargement sans réseau ; le cache est versionné (`VERSION`) pour des mises à jour propres.
- `manifest.webmanifest` rend l'application installable (nom, icônes, thème, plein écran).
- `fonts.css` + `assets/fonts/` hébergent la police Inter localement (plus de dépendance Google Fonts).
- `assets/vendor/supabase-js-2.110.7.min.js` héberge le SDK Supabase localement : plus aucune dépendance CDN au chargement (un filet de secours ne va sur le CDN que si le fichier local manque). Le SDK est précaché par le service worker pour l'usage hors ligne.
- **Les appels Supabase (données et authentification) ne sont jamais mis en cache** : la synchronisation et la connexion passent toujours par le réseau, donc rien ne change à ce niveau.

Ce que le mode hors ligne permet et ne permet pas :

| Action | Hors ligne | Retour en ligne |
|---|---|---|
| Charger et ouvrir l'application | Oui, après une première visite en ligne | — |
| Saisir / modifier des données (élèves, paiements…) | Oui (stockage local) | Se synchronise et se propage aux autres appareils |
| Gérer les comptes utilisateurs (créer, rôle, mot de passe) | Non — passe par la fonction serveur `admin-users` | À faire en ligne |
| Se connecter la première fois sur un appareil | Non — authentification serveur requise une fois | Session mémorisée ensuite pour l'usage hors ligne |

## Données et synchronisation

L'application utilise Supabase pour partager les données entre plusieurs appareils connectés avec les mêmes comptes.

- `cloud-config.js` active la synchronisation Supabase et contient l'URL du projet et la clé publique publishable (source unique de configuration lue par l'application).
- `relational-sync.js` active la synchronisation progressive avec les tables relationnelles Supabase.
- `server-receipts.js` demande les numéros de reçus au compteur serveur `mienra_next_receipt_no`.
- `production-tools.js` ajoute l'état système et le mode production.
- `mienra_app_state` reste conservée comme sauvegarde JSON pendant la transition.
- La table `profiles` porte le rôle applicatif de chaque utilisateur.
- La fonction Supabase `admin-users` permet à l'administrateur de créer, modifier, verrouiller ou supprimer les comptes de connexion.

Les suppressions restent protégées par des `tombstones` dans le mode JSON de secours, ce qui évite que des données supprimées reviennent après actualisation ou synchronisation.

## Mode production

Avant de remettre l'application à l'école, ouvrir le menu **État système** avec un compte administrateur ou directeur.

À vérifier :

- Supabase configuré et session authentifiée.
- Tables relationnelles actives.
- Année scolaire correcte.
- Compteur de reçus cohérent.
- Sauvegarde récente.

Quand tout est correct, l'administrateur peut activer le **mode production**. Ce mode bloque :

- la réinitialisation complète ;
- l'import JSON ;
- la restauration locale ;
- la suppression des données démo/test.

Le mode production ne bloque pas les opérations normales : ajouter un élève, enregistrer un paiement, imprimer un reçu, consulter les rapports ou exporter une sauvegarde.

## Base relationnelle Supabase

La base relationnelle sépare les données en tables métier : écoles, années scolaires, classes, élèves, inscriptions, paiements, compteurs de reçus et journal.

Fichiers utiles :

- `supabase/relational-schema-compatible.sql` : schéma relationnel compatible avec Supabase SQL Editor.
- `supabase/relational-runtime-fixes.sql` : compteur serveur, vues de rapports, audit et accès REST authentifié.
- `supabase/migrate-json-to-relational.sql` : copie les données existantes de `mienra_app_state` vers les tables relationnelles.
- `supabase/post-migration-checks.sql` : contrôles après migration.
- `docs/migration-relationnelle.md` : ordre d'exécution, vérifications et précautions.
- `docs/checklist-recette-ecole.md` : scénario de test avant utilisation réelle.

Important : l'application publiée utilise les tables relationnelles quand elles sont prêtes et contiennent des données. Si elles ne sont pas encore disponibles, elle retombe sur l'ancien stockage JSON partagé pour éviter une coupure.

## Sécurité

La connexion robuste passe par Supabase Auth. Les rôles utilisés par l'application sont lus côté serveur depuis `profiles`, pas depuis l'interface.

Points importants :

- Ne jamais publier la clé `service_role` dans GitHub Pages.
- Créer au moins un compte administrateur dans Supabase Auth avant de durcir les règles RLS.
- Conserver des sauvegardes JSON régulières pendant l'année scolaire.
- Tester les rôles après migration : administrateur, directeur, secrétaire et consultation.
- Activer le mode production seulement après avoir nettoyé les données de test et validé les reçus.

Guides utiles :

- `docs/securite-supabase.md`
- `docs/migration-relationnelle.md`
- `docs/checklist-recette-ecole.md`
- `docs/creer-comptes-depuis-app.md`
- `supabase/admin-setup.sql`
- `supabase/schema.sql`
- `supabase/relational-schema-compatible.sql`
- `supabase/relational-runtime-fixes.sql`
- `supabase/post-migration-checks.sql`

## Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` publie automatiquement l'application statique à chaque push sur la branche :

`claude/project-analysis-qllb86`

Fichiers servis :

- `index.html`
- `styles.css`
- `design-polish.css`
- `dashboard-filters.css`
- `responsive.css`
- `production-tools.css`
- `redesign.css`
- `fonts.css` (+ `assets/fonts/`)
- `manifest.webmanifest`
- `sw.js`
- `app-pro.js`
- `relational-sync.js`
- `server-receipts.js`
- `production-tools.js`
- `dashboard-role-fix.js`
- `cloud-config.js`
- `assets/`
- `.nojekyll`

## Tests

La suite de tests protège les calculs financiers, les reçus et la synchronisation.

```bash
node tests/run.js
```

Le workflow `.github/workflows/tests.yml` exécute aussi ces tests sur GitHub Actions.

## Limite actuelle

La bascule relationnelle est progressive : le site garde le JSON partagé comme secours pendant les premiers tests réels. Après validation sur les données de l'école, on pourra retirer progressivement l'ancien stockage `mienra_app_state`.
