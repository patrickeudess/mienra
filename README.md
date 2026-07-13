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
- Rapports complets et exports CSV.
- Utilisateurs, rôles, verrouillage d'accès et journal des actions.
- Sauvegarde JSON complète avec rappel périodique.

## Données et synchronisation

L'application utilise Supabase pour partager les données entre plusieurs appareils connectés avec les mêmes comptes.

- `cloud-config.js` active la synchronisation Supabase.
- `supabase-config.js` contient la clé publique publishable.
- La table `mienra_app_state` conserve aujourd'hui l'état partagé de l'école.
- La table `profiles` porte le rôle applicatif de chaque utilisateur.
- La fonction Supabase `admin-users` permet à l'administrateur de créer, modifier, verrouiller ou supprimer les comptes de connexion.

Les suppressions sont protégées par des `tombstones`, ce qui évite que des données supprimées reviennent après actualisation ou synchronisation.

## Base relationnelle Supabase

Une base relationnelle est maintenant préparée pour l'étape suivante. Elle sépare les données en tables métier : écoles, années scolaires, classes, élèves, inscriptions, paiements, compteurs de reçus et journal.

Fichiers utiles :

- `supabase/relational-schema-compatible.sql` : schéma relationnel compatible avec Supabase SQL Editor.
- `supabase/migrate-json-to-relational.sql` : copie les données existantes de `mienra_app_state` vers les tables relationnelles.
- `docs/migration-relationnelle.md` : ordre d'exécution, vérifications et précautions.

Important : l'application publiée continue de fonctionner sur l'état JSON partagé tant que l'adaptateur applicatif relationnel n'est pas activé. Le schéma relationnel est donc prêt, mais la bascule complète doit être faite et testée comme une étape séparée.

## Sécurité

La connexion robuste passe par Supabase Auth. Les rôles utilisés par l'application sont lus côté serveur depuis `profiles`, pas depuis l'interface.

Points importants :

- Ne jamais publier la clé `service_role` dans GitHub Pages.
- Créer au moins un compte administrateur dans Supabase Auth avant de durcir les règles RLS.
- Conserver des sauvegardes JSON régulières pendant l'année scolaire.

Guides utiles :

- `docs/securite-supabase.md`
- `docs/migration-relationnelle.md`
- `docs/creer-comptes-depuis-app.md`
- `supabase/admin-setup.sql`
- `supabase/schema.sql`
- `supabase/relational-schema-compatible.sql`

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

La version publiée est adaptée à une école pilote avec personnel de confiance. La prochaine amélioration majeure est la bascule du code applicatif vers les tables relationnelles Supabase déjà préparées, afin d'obtenir des contrôles serveur plus stricts et des rapports SQL plus robustes.
