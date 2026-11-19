# Recherche produit — US-014

`GET /api/products` accepte un paramètre de requête `q`, combinable avec les filtres de [US-016](CATALOGUE-FILTERS.md), le tri de [US-017](CATALOGUE-SORT.md) et la pagination. Aucune nouvelle route : la recherche est un critère du catalogue. Contrat partagé : version **1.4.0**.

```text
GET /api/products?q=thé%20pêche
GET /api/products?q=peche&typeTea=vert&sort=price_asc&page=1&limit=20
```

## Règle de correspondance

| Règle | Détail |
|---|---|
| Champs cherchés | nom du produit, origine, type de thé, nom de chaque ingrédient. La description n'est pas cherchée. |
| Casse et accents | Ignorés des deux côtés (`lower(unaccent(…))`) : `peche`, `Pêche` et `PECHE` sont équivalents. Les ligatures sont décomposées : `coeur` trouve « Cœur de Pêche ». |
| Mots | La saisie est découpée sur les espaces. **Chaque mot** doit être trouvé (ET), éventuellement dans des champs différents : `vert peche` trouve un thé de type « vert » dont le nom ou un ingrédient contient « pêche ». Les mots répétés comptent une fois. |
| Partie de mot | Un mot est cherché comme sous-chaîne : `jasm` trouve « Jasmin ». |
| Caractères spéciaux | `%`, `_` et `\` sont pris au pied de la lettre (pas de jokers). La valeur est toujours passée en paramètre SQL. |
| Ordre | Pas de tri par pertinence : l'ordre suit `sort` (défaut `name_asc`), départagé par l'UUID. L'ordre est donc stable entre les pages. |
| Combinaison | ET avec les autres filtres. La recherche, les filtres et le tri sont appliqués avant le comptage et la pagination. |

Limite connue : la ponctuation n'est pas normalisée (`earl-grey` ne trouve pas « Earl Grey »).

## Validation de `q`

- Valeur unique, de **2 à 100 caractères** après nettoyage.
- Les espaces de début et de fin sont retirés et les espaces multiples réduits à un seul.
- **Paramètre absent** : aucune restriction (tout le catalogue publié).
- **Requête vide** (`?q=`, ou seulement des espaces), un seul caractère, plus de 100 caractères ou paramètre répété (`?q=a&q=b`) : **400 `VALIDATION_ERROR`** avec `details: [{ field: "q", constraints: [...] }]`. Le front doit **retirer** le paramètre quand le champ de recherche est vidé, conformément à la règle des filtres.

## Produits non publiés

La table `products` a une colonne `published` (booléen, `true` par défaut ; les produits existants restent visibles). Un produit non publié est exclu de **toutes** les routes publiques, pas seulement de la recherche :

- catalogue et recherche `GET /api/products` (liste et total) ;
- fiche `GET /api/products/{id}` : 404 `NOT_FOUND` ;
- `GET /api/products/{id}/similar` : 404 pour le produit lui-même, et jamais suggéré ;
- choix `GET /api/products/filters` : ses origines, types, ingrédients et prix ne sont pas proposés, et une valeur présente uniquement sur un produit non publié renvoie 400 `isAllowed`.

Aucune route d'administration ne permet encore de publier ou dépublier (US-080 à 082). En attendant : `UPDATE products SET published = false WHERE id = '…';`.

## Réponses et erreurs

| HTTP | Cas |
|---|---|
| 200 | `{ data, meta }` du catalogue. Sans correspondance : `data: []`, `total: 0`, `totalPages: 0`. |
| 400 `VALIDATION_ERROR` | `q` vide, trop courte, trop longue ou répétée (voir ci-dessus). |
| 503 `STOCK_UNAVAILABLE` | Base de données indisponible ou requête en échec. Code commun aux routes de lecture du catalogue, défini par [US-004](PRODUCT-AVAILABILITY.md). Aucun détail technique (SQL, hôte, message du pilote) n'est renvoyé. Le front peut proposer de réessayer. |

```json
{
  "statusCode": 503,
  "code": "STOCK_UNAVAILABLE",
  "message": "Stock momentanément non consultable. Réessayez plus tard.",
  "path": "/api/products",
  "timestamp": "2026-11-19T10:00:00.000Z"
}
```

La conversion en 503 est faite par `readStock()` (`availability/availability.ts`), qui enveloppe chaque lecture du catalogue, recherche comprise.

## Base de données

Migration `1795564800000-AddProductSearch` :

- `CREATE EXTENSION IF NOT EXISTS unaccent` : extension « trusted » depuis PostgreSQL 13, fournie par l'image `postgres:17-alpine`, que le propriétaire de la base peut installer ;
- `ALTER TABLE products ADD published boolean NOT NULL DEFAULT true`.

Aucun index texte n'est créé : sur un catalogue de quelques centaines de produits, le parcours séquentiel suffit. Si le volume grandit, prévoir `pg_trgm` et un index sur une version immuable de `unaccent`.

## Vérification

```bash
npm run lint
npm test -- --runInBand
docker compose exec -T api sh -c \
'TEST_DB_HOST=postgres TEST_DB_PORT=5432 TEST_DB_USER="$DB_USER" TEST_DB_PASSWORD="$DB_PASSWORD" TEST_DB_NAME=brume_search_test npm run test:e2e -- --runInBand test/products.e2e-spec.ts'
```

Le bloc e2e `GET /api/products?q= (US-014)` utilise un jeu dédié (« Thé vert Pêche », « Cœur de Pêche », « Crème Brûlée », un produit non publié…) et couvre les critères de validation de la story :

- nom avec accents et plusieurs correspondances, quelle que soit la casse ;
- requête vide, trop courte, trop longue ou répétée (400) ;
- requête sans résultat (200, total 0) ;
- panne de la base (table renommée pendant le test) : 503 sans fuite d'information, puis retour à la normale ;
- exclusion des produits non publiés sur toutes les routes, combinaison avec filtres, tri et pagination, jokers LIKE et injection SQL.

Les tests unitaires couvrent la construction des conditions de recherche et le filtre sur les produits publiés (`products.service.spec.ts`).
