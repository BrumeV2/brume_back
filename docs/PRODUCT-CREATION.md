# Création de produit — US-080

## Route

```text
POST /api/admin/products
Origin: <origine autorisée>
X-CSRF-Protection: 1
Cookie: brume_session=…
```

> **Droits** : la route exige une session valide, mais **pas encore le rôle ADMIN**. La garde de rôle est en cours de développement ; il faudra l'ajouter sur `AdminProductsController` (voir le `TODO(admin)`). Tant qu'elle n'est pas posée, tout compte connecté peut créer un produit.

## Corps

```json
{
  "name": "Assam Bergamote",
  "description": "Thé noir corsé relevé de bergamote",
  "origin": "Inde",
  "typeTea": "noir",
  "image": "data:image/png;base64,…",
  "howMuchCaffeine": "high",
  "moment": "morning",
  "published": false,
  "ingredientIds": ["<uuid>", "<uuid>"],
  "formats": [
    { "sku": "ASB-BAG-100", "packaging": "bag", "quantity": 100, "price": 1290, "stock": 12 },
    { "sku": "ASB-TIN-150", "packaging": "tin", "quantity": 150, "price": 2490 }
  ]
}
```

| Champ | Règle |
|---|---|
| `name` | obligatoire, 1 à 150 caractères après suppression des espaces de bord |
| `description`, `origin`, `typeTea`, `image` | facultatifs ; chaîne vide enregistrée comme `null` ; 2000, 100, 50 caractères max (`image` : non bornée) |
| `howMuchCaffeine`, `moment` | énumérations existantes, obligatoires |
| `published` | facultatif, **`false` par défaut (brouillon)** |
| `ingredientIds` | 1 à 50 UUID distincts d'ingrédients existants |
| `formats` | 1 à 20 formats ; `sku` et couple `packaging` + `quantity` distincts dans la requête |
| `formats[].sku` | **référence unique dans tout le catalogue**, `^[A-Z0-9-]{2,40}$`, mise en majuscules à la réception |
| `formats[].quantity` | grammage, entier de 1 à 100 000 |
| `formats[].price` | centimes TTC, entier ≥ 1 |
| `formats[].stock` | entier ≥ 0, `0` par défaut |

Un produit créé par l'API est donc toujours **complet** (au moins un format et un ingrédient) et donc publiable.

## Réponses

| HTTP | Code | Cas |
|---|---|---|
| 201 | — | `AdminProductDto` : produit, `published`, formats avec `sku` et stock exact, `createdById` |
| 400 | `VALIDATION_ERROR` | champ invalide (chemin imbriqué : `formats.0.price`), champ inconnu, ingrédient introuvable (`ingredientIds` / `exists`) |
| 401 | `UNAUTHENTICATED` | pas de session |
| 403 | `FORBIDDEN` | `Origin` ou `X-CSRF-Protection` manquant |
| 409 | `VALIDATION_ERROR` | référence déjà utilisée : `details: [{ field: "formats.1.sku", constraints: ["unique"] }]` |

## Garanties

- **Atomicité** : produit, formats et liens ingrédients sont écrits dans une seule transaction. Toute erreur annule l'ensemble, il n'y a jamais de produit partiel.
- **Unicité** : la contrainte `UQ_product_formats_sku` en base fait foi. Le service contrôle d'abord les références pour désigner le format fautif. Si deux créations concurrentes utilisent la même référence, la violation de contrainte est convertie en 409 et une seule création aboutit.
- **Publication** : un brouillon (`published = false`) est absent de toutes les routes publiques : catalogue, fiche (404), similaires et choix de filtres. Passer `published` à `true` suffit à le rendre visible. La modification d'un produit existant relève de US-081.
- **Audit** : `products.createdById` (FK vers `utilisateurs`, `ON DELETE SET NULL`), `created_at`, et un log applicatif `Produit créé id=… publié=… formats=… par utilisateur=…`. Le corps de la requête et l'image ne sont pas journalisés.

## Données existantes

La migration `AddProductCreation1795737600000` :

- ajoute `product_formats.sku` (unique, contrôlé par `CHECK`) ; les formats existants reçoivent une référence générée `F-XXXXXXXXXXXX`. Ce même défaut s'applique aux insertions techniques sans référence (seeds, fixtures). Le seed du catalogue génère des références lisibles `BR001-BAG-50` ;
- ajoute `products.createdById`, à `NULL` pour les produits antérieurs.

Le défaut base de `products.published` reste `true` pour ne pas masquer les données existantes. L'état brouillon est appliqué par l'API.

## Écarts avec le contrat OpenAPI

Le contrat (`/admin/products`, `CreateProductRequest`) décrit le modèle cible : catégories, `type`, `vatRateBps`, variantes avec `label`, `slug`. L'implémentation suit le modèle actuel : formats, `typeTea`, pas de slug ni de TVA. La « variante » du contrat correspond au format, et son `sku` est repris tel quel.

## Tests

- Unitaires : `admin-products.service.spec.ts` et `dto/create-product.dto.spec.ts`.
- HTTP + PostgreSQL : `test/admin-products.e2e-spec.ts`. Le test couvre le brouillon invisible puis visible après publication, la création publiée, la référence répétée, les créations concurrentes, les données invalides sans écriture, la session et le CSRF.

```bash
TEST_DB_NAME=brume_admin_products_test npm run test:e2e -- test/admin-products.e2e-spec.ts
```

Lancer chaque suite e2e sur sa propre base `_test`, ou une à une : deux suites en parallèle sur la même base se perturbent.
