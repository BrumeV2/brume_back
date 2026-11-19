# Tri du catalogue — US-017

`GET /api/products` accepte un paramètre `sort`, combinable avec les filtres de [US-016](CATALOGUE-FILTERS.md) et la pagination. Contrat partagé : version **1.3.0**.

## Valeurs

| `sort` | Clé principale | Départage |
|---|---|---|
| `name_asc` (défaut) | nom A → Z | UUID |
| `name_desc` | nom Z → A | UUID |
| `price_asc` | `lowestPrice` croissant, **sans prix en dernier** | nom, puis UUID |
| `price_desc` | `lowestPrice` décroissant, **sans prix en dernier** | nom, puis UUID |
| `newest` | date d'ajout au catalogue, du plus récent au plus ancien | nom, puis UUID |
| `rating_desc` | `averageRating` décroissant, **sans note en dernier** | `ratingCount` décroissant, nom, puis UUID |

- Le tri est **global** : il s'applique après les filtres et avant la pagination. L'UUID en dernière clé rend l'ordre total, ce qui évite qu'un produit soit répété ou oublié d'une page à l'autre, même quand plusieurs produits ont le même prix ou la même note.
- **Données absentes** : un produit sans format (pas de prix) ou sans avis noté est toujours placé en fin de liste, dans le sens croissant comme décroissant.
- Valeur unique et sensible à la casse. Une valeur inconnue, vide ou répétée (`?sort=a&sort=b`) renvoie **400 VALIDATION_ERROR** sur le champ `sort`.

```text
GET /api/products?sort=price_asc&typeTea=noir&page=2&limit=20
```

## Indicateurs exposés

Chaque produit du catalogue, ainsi que chaque produit de `GET /api/products/{id}/similar`, contient les valeurs utilisées par les tris. Elles sont calculées côté serveur à chaque requête :

| Champ | Type | Calcul |
|---|---|---|
| `lowestPrice` | entier ou `null` | Prix du format le moins cher, en centimes, quel que soit le filtre de prix. `null` si aucun format. |
| `averageRating` | nombre ou `null` | Moyenne des notes (1 à 5) des avis, arrondie à une décimale pour l'affichage. Le tri utilise la moyenne exacte. `null` si aucune note. |
| `ratingCount` | entier | Nombre d'avis **notés** du produit. |

## Table `profile_products`

Les avis sont stockés dans `profile_products`, qui relie un profil client (`profils`) à un produit :

| Colonne | Type | Règle |
|---|---|---|
| `profileId`, `productId` | uuid | Clés étrangères, suppression en cascade |
| `type` | enum `favorite` \| `creation` \| `review` | Un seul lien de chaque type par profil et par produit |
| `note` | int, nullable | Entre 1 et 5 ; uniquement pour `review` |
| `review` | text, nullable | Texte de l'avis ; uniquement pour `review` |

Seuls les liens `review` avec une note entrent dans `averageRating` et `ratingCount`. Un avis sans note, un favori ou une création n'influencent pas le tri.

Cette story **n'expose aucune route d'écriture** sur cette table : la création des avis, favoris et créations relève de leurs propres stories (Epic 10 notamment).

## Données de développement

```bash
npm run seed           # catalogue (vide aussi profile_products)
npm run seed:reviews   # 10 clients fictifs @brume.test, avis, favoris et créations
```

`seed:reviews` est rejouable : il supprime puis recrée les comptes `@brume.test`. Environ 40 % des produits restent sans avis, et quelques avis n'ont pas de note, pour pouvoir vérifier le tri.

## Vérification

Les tests HTTP (`test/products.e2e-spec.ts`, bloc US-017) utilisent un jeu dédié qui couvre :

- un tri par prix sur plusieurs pages avec des prix égaux ;
- un produit sans format ;
- un tri par note avec des produits sans avis, des avis sans note et un favori ;
- le tri combiné à un filtre, ainsi que les valeurs invalides.

Voir [CATALOGUE-FILTERS.md](CATALOGUE-FILTERS.md#vérification) pour lancer ces tests sur une base `_test`.
