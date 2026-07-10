# Créer les comptes depuis l'application (admin)

Objectif : l'**administrateur** crée les comptes (secrétaire, directeur…)
directement dans **MIENRA → Utilisateurs**, sans ouvrir Supabase. À faire
**une seule fois** : déployer la petite fonction serveur `admin-users`.

Pourquoi une fonction serveur ? Créer un vrai compte (e-mail + mot de passe)
exige la **clé « maître »** de Supabase. On ne peut pas la mettre dans la page
web (faille). La fonction la garde **côté serveur** et vérifie que seul un
administrateur peut créer/supprimer des comptes.

---

## Déploiement (au choix : Dashboard ou CLI)

### Méthode A — Tableau de bord Supabase (sans rien installer)

1. Supabase → projet **mienra** → menu de gauche **Edge Functions**.
2. **Deploy a new function** (ou « Create function »).
3. **Nom exact** : `admin-users` (avec le tiret).
4. Efface l'exemple, **colle tout le contenu** de
   [`supabase/functions/admin-users/index.ts`](../supabase/functions/admin-users/index.ts).
5. **Deploy**.

Rien d'autre à configurer : la clé `SUPABASE_SERVICE_ROLE_KEY` est déjà
fournie automatiquement à la fonction.

### Méthode B — CLI Supabase (si tu l'utilises déjà)

```bash
supabase functions deploy admin-users --project-ref xixhyehyoucjuashplyx
```

---

## Prérequis (déjà en place normalement)

- La table `profiles` existe et l'administrateur y a le rôle
  `Administrateur` (fait via `supabase/admin-setup.sql`). C'est ce qui permet
  à la fonction de reconnaître « l'admin ».

---

## Utilisation (une fois la fonction déployée)

Dans **MIENRA → Utilisateurs → Ajouter un utilisateur**, connecté en admin :

1. **Nom** (ex. « Awa Secrétaire »)
2. **Identifiant** (ex. `secretaire`) — l'app en fera l'e-mail
   `secretaire@mienra.app`.
3. **Mot de passe** — celui que tu communiques à la personne.
4. **Rôle** : `Secrétaire`, `Directeur` ou `Consultation`.
5. **Enregistrer** → le compte de connexion est créé automatiquement.

La personne se connecte sur son ordinateur avec **son identifiant** et **son
mot de passe**, et voit l'application **selon son rôle**.

- **Modifier le mot de passe** : ré-ouvre l'utilisateur, saisis un nouveau mot
  de passe (laisser vide = inchangé), enregistre.
- **Supprimer / couper l'accès** : bouton Supprimer → le compte de connexion
  Supabase est supprimé et l'accès est **définitivement révoqué**.

> Astuce : tu peux aussi utiliser une **vraie adresse e-mail** comme
> identifiant (mets l'adresse complète dans « Identifiant »). La personne se
> connecte alors avec cette adresse.

## En cas de souci

- « Compte de connexion non enregistré… » à la création → la fonction n'est
  pas déployée (ou pas nommée exactement `admin-users`). Refais le déploiement.
- « Action réservée à l'administrateur » → le compte connecté n'a pas le rôle
  `Administrateur` dans `profiles` (relance `supabase/admin-setup.sql`).
