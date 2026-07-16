# Configuration Supabase pour MIENRA Web

Objectif : connecter MIENRA Web à une vraie base de données en ligne tout en gardant l'hébergement sur GitHub Pages.

## Architecture retenue

- Frontend : GitHub Pages
- Base de données : Supabase
- Stockage provisoire si Supabase n'est pas configuré : navigateur local

## Étapes à faire dans Supabase

1. Créer un projet Supabase.
2. Créer les tables métiers suivantes :
   - `schools`
   - `classes`
   - `students`
   - `enrollments`
   - `payments`
   - `activity_logs`
3. Copier le Project URL.
4. Copier la clé publishable (`anon public`).
5. Coller ces valeurs dans le fichier `cloud-config.js` (unique fichier de configuration lu par l'application) :

```js
window.MIENRA_CLOUD = {
  enabled: true,
  provider: "supabase",
  supabaseUrl: "https://VOTRE-PROJET.supabase.co",
  supabaseAnonKey: "VOTRE_CLE_PUBLISHABLE",
  stateId: "epp-mienrassou"
};
```

> Ne jamais coller la clé `service_role` dans ce fichier : il est publié sur GitHub Pages.

## Tables recommandées

### schools

Champs recommandés :

- id
- name
- code
- year
- phone
- email
- address
- director
- logo
- receipt_prefix
- matricule_year
- receipt_footer
- created_at

### classes

- id
- school_id
- name
- level
- fee
- created_at

### students

- id
- school_id
- matricule
- name
- gender
- birth
- class_name
- parent
- phone
- address
- status
- created_at

### enrollments

- id
- school_id
- student_id
- year
- class_name
- amount
- discount
- date
- note
- created_at

### payments

- id
- school_id
- receipt_no
- student_id
- amount
- mode
- date
- cashier
- note
- created_at

### activity_logs

- id
- school_id
- user_name
- action
- created_at

## Sécurité

Pour tester rapidement, on peut utiliser la clé `anon public` côté GitHub Pages.

Mais pour une vraie utilisation par plusieurs écoles, il faudra :

- activer Supabase Auth ;
- ajouter une table de profils utilisateurs ;
- limiter les données par école ;
- renforcer les règles RLS ;
- éviter les mots de passe simples dans le frontend.

## Fonctionnement attendu

Quand Supabase est configuré :

- les élèves sont enregistrés dans Supabase ;
- les classes sont enregistrées dans Supabase ;
- les inscriptions sont enregistrées dans Supabase ;
- les paiements sont enregistrés dans Supabase ;
- les données restent disponibles même si l'utilisateur change d'ordinateur.

Quand Supabase n'est pas configuré :

- MIENRA Web continue de fonctionner avec les données locales du navigateur ;
- un message indique que la base Supabase n'est pas encore connectée.
