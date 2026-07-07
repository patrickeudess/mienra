# Sécuriser MIENRA Web avec Supabase Auth

Aujourd'hui, l'application partage ses données via une seule table Supabase
protégée par une politique ouverte au rôle `anon`. Comme la clé `anon` est
publique (visible dans `cloud-config.js`), **n'importe qui peut lire et
écraser toutes les données de l'école**, y compris les comptes.

Ce guide bascule l'application vers **Supabase Auth** : seules les personnes
connectées avec un vrai compte (e-mail + mot de passe géré par Supabase, donc
haché et jamais stocké en clair) peuvent accéder aux données.

Le code de l'application est **déjà prêt** :

- si Supabase Auth n'est pas encore configuré, l'application continue de
  fonctionner comme avant (repli local) — **aucune coupure** ;
- dès que les comptes existent, la connexion passe par Supabase Auth (jeton
  JWT), et les mots de passe ne sont plus jamais envoyés au cloud.

## Ordre des opérations (à respecter pour éviter toute coupure)

### Étape 1 — Créer les comptes dans Supabase Auth

Dans **Supabase → Authentication → Users → Add user**, créez un compte par
utilisateur. L'application transforme l'identifiant en e-mail avec le domaine
`mienra.app` (modifiable via `AUTH_EMAIL_DOMAIN` dans `app-pro.js`) :

| Identifiant saisi | E-mail à créer dans Supabase | Cochez |
|---|---|---|
| `admin` | `admin@mienra.app` | ✅ Auto Confirm User |
| `directeur` | `directeur@mienra.app` | ✅ Auto Confirm User |
| `secretaire` | `secretaire@mienra.app` | ✅ Auto Confirm User |
| `consultation` | `consultation@mienra.app` | ✅ Auto Confirm User |

Choisissez un mot de passe fort pour chacun (différent des `...123` de test).

### Étape 2 — Exécuter le schéma SQL sécurisé

Dans **Supabase → SQL Editor**, exécutez le contenu de
[`supabase/schema.sql`](../supabase/schema.sql). Il :

- réserve la lecture/écriture de l'état aux utilisateurs **authentifiés**
  (fin de l'accès `anon`) ;
- crée la table `profiles` (rôle applicatif de chaque compte).

### Étape 3 — Renseigner le rôle de chaque compte

Récupérez l'`id` (UUID) de chaque compte dans **Authentication → Users**, puis
dans le **SQL Editor** :

```sql
insert into public.profiles (id, name, role) values
  ('<uuid-admin>',        'Administrateur', 'Administrateur'),
  ('<uuid-directeur>',    'Directeur',      'Directeur'),
  ('<uuid-secretaire>',   'Secrétaire',     'Secrétaire'),
  ('<uuid-consultation>', 'Consultation',   'Consultation')
on conflict (id) do update set name = excluded.name, role = excluded.role;
```

Les rôles valides (identiques à l'application) : `Administrateur`,
`Directeur`, `Secrétaire`, `Consultation`.

### Étape 4 — Se connecter

Rechargez https://patrickeudess.github.io/mienra/ et connectez-vous avec un
identifiant (ex. `admin`) et son nouveau mot de passe Supabase. La mention
« Mode données » passe à **Données partagées** et la synchronisation utilise
désormais le jeton de l'utilisateur.

> Tant que l'étape 2 n'est pas faite, l'application reste en mode local
> historique : c'est normal et sans risque de coupure.

## Ce que ça change concrètement

- **Plus d'accès anonyme** : la clé publique seule ne permet plus rien.
- **Mots de passe hachés** par Supabase, jamais stockés en clair ni
  synchronisés (l'application retire les mots de passe de l'état envoyé au
  cloud dès qu'un utilisateur est authentifié).
- **Rôles centralisés** dans la table `profiles`.

## Aller plus loin (optionnel)

- Restreindre l'inscription (Authentication → Providers → Email → désactiver
  « Enable Sign-ups ») pour que seuls les comptes créés par l'administrateur
  existent.
- Pour du multi-école, ajouter une colonne `school_id` à `mienra_app_state`
  et à `profiles`, et conditionner la RLS sur l'appartenance de l'utilisateur
  à l'école.
