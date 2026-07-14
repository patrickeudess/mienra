# Tests MIENRA (application web)

Suite de tests **sans dépendance** : elle charge `app-pro.js` dans un bac à
sable Node et vérifie les parties sensibles (surtout les **calculs d'argent**
et la **synchronisation**).

## Lancer les tests

```bash
node tests/run.js
```

Sortie attendue : `X/X assertions réussies — tout est vert ✅` (code de sortie
0 ; non-zéro si un test échoue). La CI (`.github/workflows/tests.yml`) les
exécute automatiquement à chaque push et sur les pull requests.

## Contenu

| Fichier | Ce qui est vérifié |
|---|---|
| `sync.test.js` | Suppressions définitives (tombstones), ajouts préservés, idempotence, cascade élève → inscriptions/paiements |
| `receipt.test.js` | Unicité des identifiants ; un numéro de reçu recyclé ne fait pas supprimer un nouveau paiement |
| `finance.test.js` | `due` / `paid` / `student` indexés = mêmes montants que la force brute ; invalidation de l'index après ajout / suppression / modification |
| `badge.test.js` | Badges de statut : tonalités correctes, HTML échappé ; `financeStatus()` reste du texte brut (contrat exports CSV / impression) |

## Ajouter un test

Créez `tests/<nom>.test.js` :

```js
module.exports = (app, t) => {
  // app.state (lecture/écriture), app.due, app.paid, app.mergeStates, ...
  t.ok(condition, "description");
  t.eq(valeur, attendu, "description");
};
```

Le harnais (`harness.js`) fournit une instance **fraîche** de l'application à
chaque suite, avec le cloud désactivé (aucun appel réseau pendant les tests).
