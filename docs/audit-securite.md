# Audit de sécurité — MIENRA Web (EPV Mienrassou)

Revue manuelle de l'application web (`index.html` + `app-pro.js` + Supabase).
Date : 2026-07-10. Portée : authentification, autorisation, exposition des
données, injection, fonction serveur, secrets.

Légende : 🔴 Élevé · 🟠 Moyen · 🟢 Faible · ℹ️ Info / bon point.

---

## 🔴 H-1 — Escalade de privilèges : le rôle est stocké dans des données modifiables par tous

**Constat.** La politique RLS de `mienra_app_state` autorise **tout utilisateur
authentifié** à **lire ET écrire** l'intégralité de l'état (une seule ligne
JSON). Or le **rôle applicatif** de chaque utilisateur est stocké **dans cet
état** (`state.users`). Un compte non-admin (ex. Secrétaire) peut donc, en
appelant directement l'API REST Supabase avec son propre jeton, **réécrire la
liste des utilisateurs** et se donner le rôle `Administrateur` — puis se
reconnecter en administrateur. Le même accès permet aussi d'**effacer ou
falsifier toutes les données** (paiements, élèves…).

**Impact.** Escalade de privilèges + sabotage/altération des données par
n'importe quel compte connecté. Les contrôles de rôle de l'interface ne
protègent pas, car ils sont contournables côté client.

**Recommandation (robuste).**
1. Faire **autorité sur le rôle depuis la table `profiles`** (écrite uniquement
   par la fonction serveur `admin-users`, jamais par le client), et **lire le
   rôle à la connexion depuis `profiles`**, pas depuis le bloc JSON.
2. À terme, migrer vers de **vraies tables** (`students`, `payments`, …) avec
   une RLS par ligne, au lieu d'un unique blob JSON tout-ou-rien.

> Tant que l'école n'a que du personnel de confiance, le risque réel est
> limité ; il devient sérieux dès qu'un compte peu fiable existe.

---

## 🟠 M-1 — Confidentialité : tout compte connecté voit toutes les données

Toute personne authentifiée peut lire l'ensemble des données de
l'établissement (pas d'isolation par utilisateur ni par école). Acceptable
pour **une** école dont tout le personnel est habilité ; à revoir
impérativement avant tout usage **multi-écoles** (ajouter `school_id` + RLS
d'appartenance).

## 🟠 M-2 — Politique de mot de passe faible

La création de compte n'exige que **6 caractères**, sans complexité. Pour des
comptes qui donnent accès à des données financières, imposer une longueur plus
élevée (≥ 10) et décourager les mots de passe évidents.

## 🟢 F-1 — CORS de la fonction ouvert à toute origine

`admin-users` renvoie `Access-Control-Allow-Origin: *`. La fonction
s'auto-protège (jeton + rôle `Administrateur` requis), donc le risque est
faible, mais on peut restreindre l'origine à
`https://patrickeudess.github.io` par prudence (défense en profondeur).

## 🟢 F-2 — Repli local de connexion

En cas de panne Supabase, un repli local (mot de passe stocké localement)
subsiste. Il ne donne accès qu'aux **données locales** de l'appareil (la RLS
bloque le cloud sans jeton). Comportement d'urgence acceptable, à documenter.

## 🟢 F-3 — Fonction `admin-users` : `listUsers` plafonné à 1000

Les actions `delete` / `set-password` retrouvent le compte par e-mail via
`listUsers({ perPage: 1000 })`. Au-delà de 1000 comptes Auth, un compte
pourrait ne pas être trouvé. Négligeable à l'échelle d'une école ; paginer si
besoin un jour.

---

## ℹ️ Bons points confirmés

- **Anti-XSS** : échappement systématique via `clean()` dans tout le rendu HTML
  (tables, reçus, journaux). Vérifié par sondage, usage cohérent.
- **Secrets** : la clé `service_role` (« maître ») reste **côté serveur**
  (variable d'environnement de la fonction), jamais dans la page. La clé
  publiable/anon dans `cloud-config.js` est **publique par conception**.
- **Fonction serveur** : vérifie le jeton **et** le rôle `Administrateur` avant
  toute action ; interdit l'auto-suppression de son propre compte.
- **Authentification** : accès anonyme fermé (RLS `authenticated`),
  contournements retirés (« Accès rapide admin », identifiants de test),
  comptes supprimés/verrouillés **bloqués** à la connexion.
- **Intégrité des données** : suppressions **définitives** (tombstones),
  identifiants **uniques** (fin des collisions de reçus).

---

## Priorités recommandées

| Priorité | Action |
|---|---|
| 1 | H-1 : rôle depuis `profiles` (serveur) au lieu du blob JSON |
| 2 | M-1 : isolation des données si multi-écoles |
| 3 | M-2 : renforcer la politique de mot de passe |
| 4 | F-1/F-2/F-3 : durcissements de confort |

## Verdict

Pour une **école unique avec personnel de confiance**, le niveau de sécurité
est désormais **correct** : la surface principale (accès anonyme, contournements
d'auth, fuite de mots de passe) est fermée. Le point restant réellement
important est **H-1** (le rôle vit dans des données modifiables par tous) : à
traiter en priorité si un compte peu fiable doit exister, ou avant un usage
multi-écoles.
