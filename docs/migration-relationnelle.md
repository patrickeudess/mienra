# Migration relationnelle Supabase

Ce guide explique comment préparer MIENRA Web pour une utilisation plus solide sur une année scolaire complète.

L'application actuelle continue de fonctionner avec `mienra_app_state`, la table JSON partagée. Les fichiers relationnels ajoutés ici préparent la prochaine étape : stocker les élèves, classes, inscriptions, paiements, reçus et traces dans des tables séparées.

## Pourquoi passer au relationnel ?

La table JSON unique est pratique pour démarrer vite, mais elle a des limites :

- une erreur de synchronisation peut toucher beaucoup de données à la fois ;
- les contrôles métier sont moins stricts ;
- les rapports deviennent plus difficiles à fiabiliser ;
- il est plus compliqué d'auditer précisément les paiements, reçus et modifications ;
- le multi-école sera difficile avec une seule grosse ligne JSON.

Le relationnel apporte :

- un matricule unique garanti par la base ;
- des reçus uniques par école ;
- des paiements reliés à un élève et une année scolaire ;
- des restrictions serveur selon les rôles ;
- des rapports plus fiables via SQL.

## Ordre recommandé

Avant toute manipulation, faire une sauvegarde depuis l'application :

1. Ouvrir **Sauvegardes**.
2. Cliquer sur **Exporter toute la base JSON**.
3. Garder ce fichier hors de l'application.

Ensuite dans **Supabase → SQL Editor** :

1. Exécuter `supabase/relational-schema-compatible.sql`.
2. Vérifier que les tables apparaissent : `schools`, `school_years`, `classes`, `students`, `enrollments`, `payments`, `receipt_counters`, `app_logs`.
3. Exécuter `supabase/migrate-json-to-relational.sql` si des données existent déjà dans `mienra_app_state`.
4. Lancer les requêtes de vérification ci-dessous.

## Vérifications rapides

```sql
select 'classes' as table_name, count(*) from public.classes
union all select 'students', count(*) from public.students
union all select 'enrollments', count(*) from public.enrollments
union all select 'payments', count(*) from public.payments
union all select 'logs', count(*) from public.app_logs;
```

Voir le suivi financier par élève :

```sql
select *
from public.student_payment_summary
order by class_name, name;
```

Voir les paiements d'une journée :

```sql
select paid_on, receipt_no, amount, paid_by, mode, cashier
from public.payments
where paid_on = current_date
order by created_at desc;
```

## Important

Cette migration **copie** les données. Elle ne supprime pas `mienra_app_state` et ne force pas encore l'application à lire les tables relationnelles.

La bascule complète se fera en deuxième étape :

- créer un adaptateur JavaScript qui lit et écrit dans `students`, `payments`, `enrollments`, etc. ;
- garder un export JSON de secours pendant la transition ;
- tester les rôles administrateur, directeur et secrétaire ;
- vérifier les rapports et reçus sur des données réelles.

## Points de contrôle avant usage réel

- Tous les utilisateurs doivent avoir un profil dans `profiles` avec `school_id` et `active = true`.
- Le secrétaire peut créer des paiements, mais la modification/suppression des paiements reste réservée à l'administrateur.
- Les frais officiels sont initialisés à 70 000 FCFA de la maternelle au CM1 et 75 000 FCFA en CM2.
- Les années scolaires sont des données centrales : chaque paiement et inscription doit être rattaché à une année.
