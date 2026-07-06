# Synchronisation des données entre appareils

La version GitHub Pages seule stocke les données dans le navigateur de chaque appareil. Pour que deux appareils connectés avec le même compte voient les mêmes élèves, paiements et reçus, l'application doit utiliser une base partagée.

Cette version est prête pour Supabase.

## 1. Créer la table

Dans Supabase, ouvrir **SQL Editor**, puis exécuter le fichier :

```text
supabase/schema.sql
```

Ce script crée la table `mienra_app_state` qui contient l'état partagé de l'application.

## 2. Configurer l'application

Ouvrir le fichier :

```text
cloud-config.js
```

Puis remplacer les valeurs vides :

```js
window.MIENRA_CLOUD = {
  enabled: true,
  provider: "supabase",
  supabaseUrl: "https://VOTRE-PROJET.supabase.co",
  supabaseAnonKey: "VOTRE-CLE-ANON",
  stateId: "epp-mienrassou"
};
```

## 3. Publier sur GitHub

Après modification de `cloud-config.js`, pousser le fichier sur la branche GitHub Pages. Tous les appareils qui ouvrent le même lien utiliseront alors la même base partagée.

## 4. Utilisation

- À la connexion, l'application charge automatiquement les données partagées.
- Après une modification, l'application sauvegarde localement et envoie les données à Supabase.
- Le bouton **Synchroniser** permet de recharger manuellement les données partagées.

Important : tant que `enabled` reste à `false`, l'application continue en mode local par navigateur.
