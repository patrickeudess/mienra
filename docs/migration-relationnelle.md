# Migration relationnelle Supabase

Ce guide explique comment préparer MIENRA Web pour une utilisation plus solide sur une année scolaire complète.

L'application peut maintenant utiliser les tables relationnelles via `relational-sync.js`. Pendant la transition, l'ancien bloc JSON `mienra_app_state` reste conservé comme sauvegarde lisible.

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
- des rapports plus fiables via SQL ;
- un compteur serveur de reçus pour éviter les doublons.

## Ordre recommandé

Avant toute manipulation, faire une sauvegarde depuis l'application :

1. Ouvrir **Sauvegardes**.
2. Cliquer sur **Exporter toute la base JSON**.
3. Garder ce fichier hors de l'application.

Ensuite dans **Supabase → SQL Editor** :

1. Exécuter `supabase/relational-schema-compatible.sql`.
2. Exécuter ou relancer `supabase/relational-runtime-fixes.sql`.
3. Vérifier que les tables apparaissent : `schools`, `school_years`, `classes`, `students`, `enrollments`, `payments`, `receipt_counters`, `app_logs`.
4. Exécuter `supabase/migrate-json-to-relational.sql` si des données existent déjà dans `mienra_app_state`.
5. Exécuter `supabase/post-migration-checks.sql` pour vérifier les données, les vues de rapports, les doublons et le journal.
6. Ouvrir l'application publiée, se connecter en administrateur, puis cliquer sur **Synchroniser**.

L'application affichera **Données relationnelles** lorsque la bascule est active. Si les tables ne sont pas encore prêtes, elle garde l'ancien mode JSON partagé au lieu de couper l'accès.

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
select *
from public.daily_payment_report
order by paid_on desc;
```

Voir les paiements détaillés :

```sql
select *
from public.payment_detail_report
order by paid_on desc, created_at desc;
```

## Tester le compteur de reçus

Après connexion dans l'application, enregistre un petit paiement réel ou test. Le reçu doit être généré par Supabase avec un numéro du type :

```text
REC-2026-0001
REC-2026-0002
```

Le compteur est conservé dans `receipt_counters` et ne doit jamais revenir en arrière. Ne lance pas directement la fonction `mienra_next_receipt_no` pour tester, car elle réserve vraiment un numéro.

## Tester les rôles

- Administrateur : peut gérer élèves, classes, paiements, utilisateurs, rapports et sauvegardes.
- Secrétaire : peut ajouter des élèves et encaisser, mais ne doit pas supprimer/modifier les paiements.
- Directeur : doit pouvoir suivre les données et rapports selon les accès définis.
- Consultation : lecture seule.

## Activation manuelle si nécessaire

Si les scripts SQL sont exécutés mais que l'application reste en mode JSON, ouvrir la console du navigateur sur le site publié et lancer :

```js
await window.mienraRelationnel.activer()
```

Puis actualiser la page. Pour vérifier l'état :

```js
await window.mienraRelationnel.etat()
```

## Important

La migration **copie** les données. Elle ne supprime pas `mienra_app_state`. Ce choix permet de garder une sauvegarde pendant la période de transition.

Pendant les premiers jours d'utilisation réelle, conserver l'habitude d'exporter une sauvegarde JSON régulière.

## Points de contrôle avant usage réel

- Tous les utilisateurs doivent avoir un profil dans `profiles` avec `school_id` et `active = true`.
- Le secrétaire peut créer des paiements, mais la modification/suppression des paiements reste réservée à l'administrateur.
- Les frais officiels sont initialisés à 70 000 FCFA de la maternelle au CM1 et 75 000 FCFA en CM2.
- Les années scolaires sont des données centrales : chaque paiement et inscription doit être rattaché à une année.
- Les vues `student_payment_summary`, `payment_detail_report` et `daily_payment_report` doivent retourner les mêmes montants que l'application.
