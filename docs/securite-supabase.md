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

## Priorité : le compte ADMIN d'abord

Le compte **administrateur** est le plus important : c'est lui qui donne (ou
retire) les accès aux autres. On commence donc par le sécuriser, puis on
ajoute les autres comptes ensuite (au même endroit, de la même façon).

### Étape 1 — Créer le compte admin dans Supabase Auth

Dans **Supabase → Authentication → Users → Add user** :

| Identifiant saisi dans l'app | E-mail à créer | Cochez |
|---|---|---|
| `admin` | `admin@mienra.app` | ✅ Auto Confirm User |

- Choisissez un **mot de passe fort** (différent des `...123` de test).
- L'application transforme l'identifiant `admin` en e-mail `admin@mienra.app`
  (domaine modifiable via `AUTH_EMAIL_DOMAIN` dans `app-pro.js`). Vous pouvez
  aussi utiliser une **vraie adresse e-mail** : dans ce cas, connectez-vous
  ensuite avec l'e-mail complet plutôt qu'avec `admin`.

### Étape 2 — Exécuter le script admin

Dans **Supabase → SQL Editor**, collez et exécutez le contenu de
[`supabase/admin-setup.sql`](../supabase/admin-setup.sql). Si vous avez utilisé
une autre adresse que `admin@mienra.app`, **modifiez la seule ligne**
`admin_email := '...'` avant de lancer. Le script :

- réserve la lecture/écriture de l'état aux utilisateurs **authentifiés**
  (fin de l'accès `anon`) ;
- crée la table `profiles` ;
- retrouve automatiquement l'UUID de l'admin par son e-mail et lui attribue le
  rôle `Administrateur` (aucun UUID à copier-coller) ;
- affiche une ligne de vérification `Administrateur` à la fin.

### Étape 3 — Se connecter en admin

Rechargez https://patrickeudess.github.io/mienra/ et connectez-vous avec
l'identifiant `admin` (ou l'e-mail complet) et le mot de passe défini à
l'étape 1. La mention « Mode données » passe à **Données partagées** :
l'accès anonyme est désormais fermé.

> Tant que l'étape 2 n'est pas faite, l'application reste en mode local
> historique : c'est normal et sans risque de coupure.

### Étape 4 — Ajouter un collaborateur (secrétaire, directeur… sans SQL)

L'application lit désormais le **rôle** dans sa propre liste
**« Utilisateurs »**. Supabase ne sert plus qu'à la **connexion** (prouver
l'identité pour ouvrir le carnet partagé). Pour chaque personne, **deux gestes,
aucun SQL** :

1. **Dans l'application → Utilisateurs → Nouvel utilisateur** : saisissez son
   identifiant (ex. `secretaire`) et choisissez son **rôle** (`Directeur`,
   `Secrétaire` ou `Consultation`). Enregistrez.
2. **Dans Supabase → Authentication → Users → Add user** : créez le compte avec
   le **même identifiant transformé en e-mail** (`secretaire` →
   `secretaire@mienra.app`), un mot de passe, et cochez **Auto Confirm User**.
   Communiquez ce mot de passe à la personne.

La personne se connecte sur son ordinateur avec son identifiant (`secretaire`)
et son mot de passe : elle voit le carnet partagé **selon son rôle**.

> Vous pouvez aussi utiliser une **vraie adresse e-mail** comme identifiant :
> mettez l'adresse complète dans le champ « Identifiant » de l'app **et** créez
> le même e-mail dans Authentication → Users. La connexion se fait alors avec
> l'adresse complète.

Rôles valides (identiques à l'application) : `Administrateur`, `Directeur`,
`Secrétaire`, `Consultation`. Le fichier
[`supabase/schema.sql`](../supabase/schema.sql) reste disponible comme
référence, mais **n'est plus nécessaire** pour ajouter des collaborateurs.

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
