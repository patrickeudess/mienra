# MIENRA Web - EPV Mienrassou

Application web de gestion scolaire pour **EPV Mienrassou**. Elle fonctionne dans le navigateur, est publiée sur GitHub Pages et synchronise les données avec Supabase lorsque l'authentification est configurée.

Lien public : https://patrickeudess.github.io/mienra/

## Fonctionnalités principales

- Tableau de bord financier et effectifs par classe.
- Désagrégation par sexe et statut scolaire.
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
- La table `mienra_app_state` conserve l'état partagé de l'école.
- La table `profiles` porte le rôle applicatif de chaque utilisateur.
- La fonction Supabase `admin-users` permet à l'administrateur de créer, modifier, verrouiller ou supprimer les comptes de connexion.

Les suppressions sont protégées par des `tombstones`, ce qui évite que des données supprimées reviennent après actualisation ou synchronisation.

## Sécurité

La connexion robuste passe par Supabase Auth. Les rôles utilisés par l'application sont lus côté serveur depuis `profiles`, pas depuis l'interface.

Points importants :

- Ne jamais publier la clé `service_role` dans GitHub Pages.
- Créer au moins un compte administrateur dans Supabase Auth avant de durcir les règles RLS.
- Conserver des sauvegardes JSON régulières pendant l'année scolaire.

Guides utiles :

- `docs/securite-supabase.md`
- `docs/creer-comptes-depuis-app.md`
- `supabase/admin-setup.sql`
- `supabase/schema.sql`

## Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` publie automatiquement l'application statique à chaque push sur la branche :

`claude/mienra-school-app-ag0l9x`

Fichiers servis :

- `index.html`
- `styles.css`
- `design-polish.css`
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

La version actuelle est adaptée à une école pilote avec personnel de confiance. Le chantier de fond suivant sera une base Supabase relationnelle complète, avec tables séparées pour élèves, paiements, inscriptions, classes et journaux.
