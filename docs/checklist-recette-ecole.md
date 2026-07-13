# Checklist de recette école - MIENRA Web

Cette checklist sert à valider l'application avant de la donner à une école pour une utilisation réelle.

## Préparation

- Exécuter `supabase/relational-schema-compatible.sql`.
- Exécuter `supabase/relational-runtime-fixes.sql`.
- Exécuter `supabase/migrate-json-to-relational.sql` si des données existent déjà.
- Exécuter `supabase/post-migration-checks.sql`.
- Ouvrir l'application, se connecter en administrateur, cliquer sur **Synchroniser**.

## Test données élèves

Créer au moins 5 élèves :

- 1 fille en Maternelle.
- 1 garçon en CP1.
- 1 élève en CE2.
- 1 élève en CM1.
- 1 élève en CM2.

Vérifier :

- chaque matricule est unique ;
- la date d'entrée dans l'établissement est visible ;
- la date d'ajout/saisie est visible ;
- le statut scolaire apparaît : Actif, Redoublant, Abandon ou Inactif.

## Test paiements

Créer au moins 3 situations :

- 1 élève soldé ;
- 1 élève avec paiement partiel ;
- 1 élève sans paiement.

Vérifier :

- le montant payé ne dépasse pas le reste à payer ;
- le champ **Payé par** apparaît sur le reçu ;
- le reste à payer est correct ;
- la mention **Soldé** apparaît quand le paiement est complet ;
- deux reçus différents n'ont jamais le même numéro.

## Test rôles

Administrateur :

- peut ajouter/modifier élèves ;
- peut encaisser ;
- peut supprimer/modifier selon les règles prévues ;
- peut voir les rapports, sauvegardes et utilisateurs.

Secrétaire :

- peut ajouter un élève ;
- peut encaisser ;
- ne doit pas pouvoir supprimer un paiement ;
- ne doit pas voir le point général complet réservé à la direction/admin.

Directeur :

- doit voir les suivis et rapports ;
- doit pouvoir contrôler les paiements et restes.

Consultation :

- lecture seule.

## Test rapports

Vérifier dans l'application :

- Tableau de bord ;
- Suivi des paiements ;
- Point journalier ;
- Rapport par classe ;
- Historique complet des paiements ;
- Journal de connexion et actions.

Vérifier dans Supabase :

```sql
select * from public.student_payment_summary order by class_name, name;
select * from public.daily_payment_report order by paid_on desc;
select * from public.payment_detail_report order by paid_on desc, created_at desc;
```

## Test sauvegarde

- Exporter une sauvegarde JSON.
- Vérifier que le fichier contient élèves, paiements, inscriptions, utilisateurs et journal.
- Garder une copie hors de l'application.

## Validation finale

L'application est prête pour le pilote si :

- les données restent visibles après actualisation ;
- deux appareils connectés au même compte voient les mêmes données ;
- les reçus sont uniques ;
- les rôles limitent correctement les accès ;
- les rapports SQL et l'application donnent les mêmes totaux.
