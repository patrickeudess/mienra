# MIENRA Web — Application fonctionnelle partageable par lien

## Objectif principal

MIENRA Web doit être une **application web fonctionnelle**, accessible par un lien public, permettant aux écoles de tester réellement les fonctionnalités de gestion scolaire avant toute installation locale.

L'objectif n'est pas de créer une simple page vitrine ni une démo limitée, mais une application utilisable depuis un navigateur, comme une application web classique.

Lien cible après activation GitHub Pages :

```text
https://patrickeudess.github.io/mienra/
```

## Positionnement technique

Le projet doit être séparé en deux axes :

### 1. MIENRA Web — priorité actuelle

Application web partageable par lien, utilisée pour tester le produit auprès des écoles.

Elle doit fonctionner dans le navigateur avec :

- HTML / CSS / JavaScript ou React / Vite ;
- stockage local temporaire au départ (`localStorage` ou IndexedDB) ;
- possibilité d'évolution vers Supabase ou une base de données en ligne ;
- hébergement gratuit sur GitHub Pages, Vercel ou Netlify.

### 2. MIENRA Desktop / Electron — pour plus tard

Version locale installable sur ordinateur, utile pour les écoles qui veulent un logiciel 100 % offline.

La partie Electron, SQLite et Prisma ne doit pas bloquer la version web. Elle doit être conservée pour une étape future.

## Fonctionnalités attendues dans MIENRA Web

### 1. Authentification

- Écran de connexion.
- Profils de test :
  - Administrateur ;
  - Directeur ;
  - Secrétaire / Comptable ;
  - Consultation.
- Gestion des droits selon le rôle.

### 2. Tableau de bord

- Nombre total d'élèves.
- Montant total attendu.
- Montant total encaissé.
- Reste à payer.
- Taux de paiement.
- Situation par classe.
- Alertes sur les impayés.

### 3. Élèves

- Ajouter un élève.
- Modifier un élève.
- Supprimer un élève.
- Générer un matricule automatique.
- Renseigner : nom, genre, date de naissance, classe, parent, contact, adresse, statut.
- Rechercher par nom, matricule, classe ou contact.
- Filtrer par classe et statut.

### 4. Classes et frais

- Créer les classes.
- Modifier les classes.
- Définir les frais scolaires par classe.
- Définir le niveau : primaire, collège, lycée.
- Modifier les montants attendus.

### 5. Inscriptions

- Inscrire un élève dans une classe et une année scolaire.
- Définir le montant attendu.
- Appliquer une remise ou réduction.
- Suivre l'année scolaire.
- Historiser les inscriptions.

### 6. Paiements

- Enregistrer un paiement.
- Gérer plusieurs versements pour un même élève.
- Modes de paiement : espèces, mobile money, chèque, virement, carte.
- Afficher automatiquement : total attendu, total payé, reste à payer.
- Supprimer ou corriger un paiement si autorisé.

### 7. Reçus

- Générer un reçu après paiement.
- Afficher les informations de l'école.
- Afficher les informations de l'élève.
- Afficher montant payé, total payé, reste à payer.
- Prévoir signature, cachet, caissier, direction.
- Impression ou sauvegarde PDF via navigateur.

### 8. Impayés

- Liste des élèves ayant un solde restant.
- Classement par montant restant.
- Filtre par classe et année.
- Contact du parent visible.
- Bouton pour enregistrer rapidement un paiement.

### 9. Rapports

- Rapport global financier.
- Rapport par classe.
- Rapport des paiements.
- Rapport des impayés.
- Export CSV.
- Impression du rapport.

### 10. Paramètres

- Nom de l'école.
- Code établissement.
- Logo ou texte court du logo.
- Téléphone, email, adresse.
- Nom du directeur.
- Année scolaire active.
- Préfixe des reçus.
- Préfixe des matricules.
- Message de bas de reçu.

### 11. Utilisateurs

- Ajouter un utilisateur.
- Modifier un utilisateur.
- Activer / désactiver un utilisateur.
- Attribuer un rôle.

### 12. Sauvegardes

- Export JSON de toutes les données.
- Import JSON.
- Réinitialisation des données.
- Sauvegarde locale automatique.

## Organisation recommandée pour la version web

```text
mienra/
├── index.html
├── styles.css
├── app.js
├── js/
│   ├── database.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── eleves.js
│   ├── inscriptions.js
│   ├── paiements.js
│   ├── recus.js
│   ├── rapports.js
│   ├── utilisateurs.js
│   ├── parametres.js
│   └── sauvegardes.js
├── assets/
│   └── logo.png
└── data/
    └── demo.json
```

## Règle importante

Ne pas présenter MIENRA Web comme une simple démo. Le wording public doit parler de :

- application web ;
- version en ligne testable ;
- application de gestion scolaire ;
- version web de validation auprès des écoles.

Éviter :

- « simple démo » ;
- « page vitrine » ;
- « prototype limité ».

## Limite connue de GitHub Pages

GitHub Pages ne permet pas d'exécuter un backend, Prisma, SQLite serveur ou Electron.

Donc, pour la version GitHub Pages :

- les données sont locales au navigateur ;
- chaque testeur a ses propres données ;
- l'application est utilisable pour tester les fonctionnalités ;
- pour une vraie utilisation multi-écoles avec données partagées, il faudra passer à Supabase, Firebase, Render, Railway ou autre backend.

## Évolution recommandée

### Étape 1 — GitHub Pages

Application web fonctionnelle dans le navigateur, avec stockage local.

### Étape 2 — Web app connectée

React / Vite + Supabase :

- authentification réelle ;
- base de données partagée ;
- multi-école ;
- gestion des rôles ;
- sauvegarde serveur.

### Étape 3 — Desktop local

Reprendre la logique métier pour produire une version Electron installable localement avec SQLite.
