# Filtres du catalogue — US-016

Le backend étend la route publique `GET /api/products` et expose les choix disponibles via `GET /api/products/filters`. Aucune modification du frontend, de table ou migration n'est nécessaire.

## Paramètres

| Paramètre | Type | Valeurs |
|---|---|---|
| `ingredients` | UUID v4, sélection multiple | Identifiants retournés par `/products/filters`, uniquement des ingrédients liés à un produit |
| `origin` | Texte, sélection multiple | Origines présentes dans le catalogue |
| `typeTea` | Texte, sélection multiple | Types de thé présents dans le catalogue, par exemple `noir`, `vert` |
| `howMuchCaffeine` | Enum, sélection multiple | `none`, `low`, `medium`, `high` |
| `moment` | Enum, sélection multiple | `morning`, `noon`, `snack`, `evening` |
| `minPrice` | Entier | Minimum inclus, en centimes, de 0 à 2147483647 |
| `maxPrice` | Entier | Maximum inclus, en centimes, de 0 à 2147483647 |
| `page` | Entier ≥ 1 | Défaut : 1 |
| `limit` | Entier de 1 à 100 | Défaut : 20 |

`minPrice` doit être inférieur ou égal à `maxPrice` lorsque les deux sont fournis. Une seule borne est également possible. Les nombres vides, décimaux, négatifs, non numériques et en notation scientifique sont refusés. Les prix ne sont pas exprimés en euros : 10 € correspond à 1000.

Les paramètres de sélection acceptent une valeur simple ou un paramètre répété, avec au plus 20 valeurs distinctes. Les sélections vides et les objets sont refusés. Les espaces de début et de fin sont retirés et les doublons sont éliminés. Les UUID sont normalisés en minuscules ; les libellés et enums sont sensibles à la casse.

## Combinaison des filtres

- **ET** entre filtres différents.
- **OU** entre valeurs d'un même filtre, y compris les ingrédients.
- Filtre absent : aucune restriction sur ce critère.
- Supprimer un filtre revient à retirer entièrement ce paramètre, pas à envoyer une chaîne vide.
- Les deux bornes de prix doivent être respectées par **un même format**. Un produit avec des formats à 500 et 1500 centimes ne correspond pas à un intervalle de 700 à 1000.
- La réponse conserve tous les formats et ingrédients du produit. Le champ `price` reste le prix du format le moins cher (« à partir de »), même si un autre format satisfait le filtre de prix. Le frontend peut identifier les formats correspondants grâce à leurs prix.
- Les produits sont triés par nom puis UUID. Les filtres sont appliqués avant le comptage et la pagination ; un produit n'apparaît qu'une fois, quel que soit son nombre de formats ou d'ingrédients correspondants.

## Exemples

Combiner deux critères :

```text
GET /api/products?origin=Inde&howMuchCaffeine=high
```

Choisir plusieurs origines et un moment :

```text
GET /api/products?origin=Inde&origin=Japon&moment=morning
```

Limiter les prix aux formats de 5 à 15 euros :

```text
GET /api/products?minPrice=500&maxPrice=1500&page=1&limit=20
```

Choisir un ingrédient : remplacer l'UUID par une valeur réellement fournie par la route de choix.

```text
GET /api/products?ingredients=UUID_INGREDIENT&typeTea=noir
```

Exemple de construction côté frontend, à intégrer dans son propre dépôt :

```ts
const params = new URLSearchParams();
for (const origin of selectedOrigins) params.append('origin', origin);
for (const id of selectedIngredientIds) params.append('ingredients', id);
if (minPrice !== undefined) params.set('minPrice', String(minPrice));
params.set('page', '1'); // Revenir à la première page quand une sélection change.
```

## Choix disponibles

`GET /api/products/filters` ne nécessite aucune session et prend ses valeurs dans le catalogue complet, indépendamment des filtres sélectionnés.

La réponse contient :

- `ingredients` : tableau `{ id, name }`, limité aux ingrédients liés à un produit, trié par nom puis UUID.
- `origin`, `typeTea` : listes distinctes triées, sans libellé nul ou vide.
- `howMuchCaffeine`, `moment` : valeurs présentes dans le catalogue, dans l'ordre des enums.
- `price` : `{ min, max }`, bornes des prix des formats en centimes.

Si le catalogue est vide, les listes sont vides et les deux bornes valent null. Les enums valides qui ne sont pas proposés parce qu'aucun produit ne les utilise restent des paramètres autorisés : ils peuvent produire un résultat vide. En revanche, une origine, un type de thé ou un UUID d'ingrédient absent du catalogue renvoie 400 ; le frontend peut recharger les choix si le catalogue a évolué.

## Réponses et erreurs

- **200** : `{ data, meta: { page, limit, total, totalPages } }`.
- Une combinaison valide sans correspondance renvoie `data: []`, `total: 0`, `totalPages: 0`.
- Une page au-delà de la dernière renvoie `data: []` tout en conservant le total filtré.
- **400 VALIDATION_ERROR** : paramètre inconnu, format incorrect, enum interdite, intervalle incohérent ou valeur de catalogue non autorisée. Les champs sont identifiés dans `details` sans reproduire leurs valeurs.

Exemple d'une valeur absente du catalogue :

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Valeur de filtre non autorisée. Consultez les choix du catalogue.",
  "details": [{ "field": "origin", "constraints": ["isAllowed"] }],
  "path": "/api/products",
  "timestamp": "2026-10-29T12:00:00.000Z"
}
```

Les requêtes utilisent des paramètres SQL liés. Les filtres relationnels sont exprimés avec `EXISTS` pour éviter les doublons et les erreurs de pagination. Les ingrédients sont vérifiés par leur relation réelle à un produit, pas uniquement par leur existence dans la table.

## Swagger et contrat

Swagger : http://localhost:3000/api/docs. Le contrat partagé est mis à jour en version **1.2.0**, avec les six filtres, les choix et le format de réponse réel du catalogue. Les anciens paramètres théoriques `q`, `category`, `type`, `inStock`, `sort`, `minPriceCents` et `maxPriceCents` ne sont pas implémentés par cette story. Utiliser `minPrice` et `maxPrice`, conformément au périmètre retenu.

Le frontend consulté contient encore un ancien contrat généré ; il devra être régénéré dans son dépôt pour intégrer ces paramètres. Aucun fichier du frontend n'a été modifié.

## Vérification

```bash
npm run build
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```

Les tests HTTP utilisent une base PostgreSQL dédiée dont le nom finit par `_test`. Les fixtures du catalogue y sont vidées, ne jamais choisir la base de développement ou de production. Voir aussi [AUTH.md](AUTH.md#validation-reproductible).

```bash
docker compose exec -T api sh -c \
'TEST_DB_HOST=postgres TEST_DB_PORT=5432 TEST_DB_USER="$DB_USER" TEST_DB_PASSWORD="$DB_PASSWORD" TEST_DB_NAME=brume_filters_test npm run test:e2e -- --runInBand'
```

Créer cette base au préalable si elle n'existe pas, avec le rôle PostgreSQL du projet. La suite couvre les six critères, la combinaison et le retrait, les sélections multiples, les ingrédients non liés, les prix inclusifs sur un même format, la pagination, les paramètres invalides, les choix disponibles, le catalogue vide et le contrat Swagger. La revue, le raccordement frontend et la validation en préproduction restent nécessaires avant la clôture produit.
