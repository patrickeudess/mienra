# MIENRA Web - EPV Mienrassou

Application web de gestion scolaire pour **EPV Mienrassou**. Elle fonctionne dans le navigateur, est publiée sur GitHub Pages et synchronise les données avec Supabase lorsque l'authentification est configurée.

Lien public : https://patrickeudess.github.io/mienra/

## Fonctionnalités principales

- Tableau de bord financier et effectifs par classe.
- Gestion des élèves avec matricule unique.
- Classes et frais officiels : 70 000 FCFA de la maternelle au CM1, 75 000 FCFA en CM2.
- Paiements par versements successifs jusqu'au solde.
- Suivi des paiements : payé, reste à payer, statut, payé par, historique par élève.
- Reçus imprimables en deux exemplaires sur une feuille A4.
- Numéros de reçus sécurisés par compteur serveur Supabase quand le mode relationnel est actif.
- Rapports complets, vues SQL relationnelles et exports CSV.
- Utilisateurs, rôles, verrouillage d'accès et journal des actions.
- Sauvegarde JSON complète avec rappel périodique.

## Données et synchronisation

L'application utilise Supabase pour partager les données entre plusieurs appareils connectés avec les mêmes comptes.

- `cloud-config.js` active la synchronisation Supabase.
- `supabase-config.js` contient la clé publique publishable.
- `relational-sync.js` active la synchronisation progressive avec les tables relationnelles Supabase.
- `server-receipts.js` demande les numéros de reçus au compteur serveur `mienra_next_receipt_no`.
- `mienra_app_state` reste conservée comme sauvegarde JSON pendant la transition.
- La table `profiles` porte le rôle applicatif de chaque utilisateur.
- La fonction Supabase `admin-users` permet à l'administrateur de créer, modifier, verrouiller ou supprimer les comptes de connexion.

Les suppressions restent protégées par des `tombstones` dans le mode JSON de secours, ce qui évite que des données supprimées reviennent après actualisation ou synchronisation.

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

`claude/mienra-school-app-ag0l9x`

Fichiers servis :

- `index.html`
- `styles.css`
- `design-polish.css`
- `dashboard-role-fix.js`
- `dashboard-filters.css`
- `app-pro.js`
- `relational-sync.js`
- `server-receipts.js`
- `cloud-config.js`
- `supabase-config.js`
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
