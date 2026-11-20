# Recherche par ingrédient — US-015

Deux briques, combinables avec la recherche [US-014](CATALOGUE-SEARCH.md), les filtres [US-016](CATALOGUE-FILTERS.md), le tri [US-017](CATALOGUE-SORT.md) et la pagination. Contrat partagé : version **1.5.0**.

1. `GET /api/ingredients?q=` : le **référentiel** d'ingrédients, avec recherche par nom ou par synonyme (autocomplétion).
2. `GET /api/products?ingredients=<uuid>&ingredientsMatch=any|all` : le catalogue paginé des produits qui contiennent ces ingrédients.

Parcours front : l'utilisateur tape « badiane » → `GET /api/ingredients?q=badiane` renvoie *Anis étoilé* → le front ajoute son UUID au paramètre `ingredients` du catalogue.

## Compositions et référentiel

La composition d'un produit est sa liste d'ingrédients (`product_ingredients`), qui pointe vers la table `ingredients`, le référentiel unique. Un ingrédient n'est donc jamais saisi en texte libre sur un produit.

- **Variantes** : une variante est un format de vente (`product_formats`). La composition est portée par le produit, donc tous ses formats ont les mêmes ingrédients. Un produit correspondant est renvoyé **une seule fois**, avec son `lowestPrice` calculé sur tous ses formats.
- Une même recette déclinée en plusieurs produits (Sencha nature, Sencha menthe, Sencha citron…) est traitée produit par produit : seuls ceux qui contiennent l'ingrédient sont renvoyés.
- **Assortiments** : les box (`boxes`, `box_products`) ne sont exposées par aucune route publique. Elles ne figurent pas dans les résultats. À traiter avec la story des box le jour où elles seront vendues.
- **Produits non publiés** : ils ne sont ni renvoyés ni comptés dans `productCount` (règle de US-014).

## `GET /api/ingredients`

Public, sans pagination (le référentiel compte quelques dizaines d'entrées).

```text
GET /api/ingredients
GET /api/ingredients?q=badiane
```

```json
[
  {
    "id": "6b1f…",
    "name": "Anis étoilé",
    "type": "dried_ingredient",
    "aliases": ["badiane"],
    "productCount": 7
  }
]
```

- Renvoie **tout** le référentiel, y compris les ingrédients présents dans aucun produit publié (`productCount: 0`). Le front peut les griser.
- Tri par nom, puis UUID.
- `q` suit les règles de validation de la recherche US-014 : valeur unique, 2 à 100 caractères après nettoyage des espaces, paramètre à retirer plutôt qu'à envoyer vide.

### Règle de synonymes

| Règle | Détail |
|---|---|
| Synonymes | Colonne `ingredients.aliases` (tableau de textes). Un synonyme pointe vers **un** ingrédient : `badiane` → *Anis étoilé*, `bissap` → *Hibiscus*, `thé rouge` → *Rooibos*… |
| Correspondance | Chaque mot de `q` (ET) doit figurer, en sous-chaîne, dans le nom **ou** un synonyme. Casse et accents ignorés (`unaccent`). `%`, `_` et `\` sont pris littéralement. |
| Recherche libre | Les synonymes sont aussi pris en compte par `GET /api/products?q=` : `q=badiane` trouve les produits contenant de l'anis étoilé. |
| Familles | Pas de regroupement automatique : `menthe` trouve *Feuilles de menthe poivrée* et *Huile essentielle de menthe poivrée* par sous-chaîne, sans lien explicite entre les deux. |

Limites connues : une sous-chaîne peut donner un faux positif (`citron` trouve aussi *Citronnelle*), et la ponctuation n'est pas normalisée (`pu erh` est déclaré en synonyme de *Pu-erh* pour cette raison).

Aucune route d'administration ne gère encore les synonymes (US-080 à 082). En attendant :

```sql
UPDATE ingredients SET aliases = ARRAY['badiane'] WHERE name = 'Anis étoilé';
```

Le seed de développement (`npm run seed`) en déclare une dizaine.

## Filtre du catalogue

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `ingredients` | UUID v4 du référentiel, paramètre répété, 20 au plus | — |
| `ingredientsMatch` | `any` : au moins un des ingrédients (OU) ; `all` : tous (ET) | `any` |

```text
GET /api/products?ingredients=UUID_MENTHE&ingredients=UUID_CITRON&ingredientsMatch=all&sort=price_asc
```

- `ingredientsMatch` est une valeur unique et sensible à la casse. Il est sans effet sans `ingredients`.
- Un UUID répété ou en majuscules est dédupliqué avant le comptage du ET.
- **Ingrédient sans résultat** : un ingrédient du référentiel présent dans aucun produit publié renvoie **200** avec `data: []` et `total: 0`.
- **Ingrédient inconnu** : un UUID absent du référentiel renvoie **400** `VALIDATION_ERROR` avec `details: [{ field: "ingredients", constraints: ["isAllowed"] }]`.

Ce comportement remplace la règle de US-016, qui refusait (400) un ingrédient lié à aucun produit.

## Réponses et erreurs

| HTTP | Cas |
|---|---|
| 200 | Liste d'ingrédients (éventuellement vide), ou page du catalogue |
| 400 `VALIDATION_ERROR` | `q` invalide, paramètre inconnu, `ingredientsMatch` hors `any`/`all` ou répété, UUID absent du référentiel |
| 503 `STOCK_UNAVAILABLE` | Base illisible ; code commun aux lectures du catalogue, sans détail technique |

## Base de données

Migration `1795651200000-AddIngredientAliases` : `ALTER TABLE ingredients ADD aliases text[] NOT NULL DEFAULT '{}'`. Elle suppose `unaccent`, installé par la migration de US-014. Aucun index : le référentiel est petit et la recherche fait un parcours séquentiel.

## Vérification

```bash
npm run lint
npm test -- --runInBand
docker compose exec -T api sh -c \
'TEST_DB_HOST=postgres TEST_DB_PORT=5432 TEST_DB_USER="$DB_USER" TEST_DB_PASSWORD="$DB_PASSWORD" TEST_DB_NAME=brume_ingredients_test npm run test:e2e -- --runInBand test/products.e2e-spec.ts'
```

Le bloc e2e « Recherche par ingrédient (US-015) » utilise un jeu dédié : une base Sencha déclinée en variantes, dont une partie seulement contient la menthe ou le citron. Il couvre :

- un ingrédient présent dans une partie seulement des variantes, renvoyé une fois par produit ;
- le OU par défaut, le ET avec `ingredientsMatch=all`, et la combinaison avec le tri, un filtre de prix et la pagination ;
- un synonyme (`badiane`) avec casse et accents variables, dans `/ingredients` et dans `q` ;
- un ingrédient sans résultat (`productCount: 0`, catalogue vide), un ingrédient présent seulement dans un produit non publié, et un UUID inconnu (400) ;
- les paramètres invalides, les jokers LIKE et l'injection SQL, la panne de base (503) et la conformité au contrat.
