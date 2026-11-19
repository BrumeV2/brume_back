# Disponibilité et commandabilité — US-004

## Périmètre livré

La référence vendable correspond à un format de vente (`product_formats`), dont le champ `stock` est la source de vérité. Le catalogue, les produits similaires et la fiche produit exposent désormais `availability` et `isOrderable`. La fiche expose ces champs pour chaque format ; les listes restent sans tableau `formats`.

Aucune table ou migration supplémentaire n'est nécessaire. Le frontend n'est pas modifié.

## Règles

| Stock du format | availability | isOrderable pour une unité |
|---|---|---|
| Supérieur à 5 | IN_STOCK | true |
| De 1 à 5 inclus | LOW_STOCK | true |
| Zéro | OUT_OF_STOCK | false |
| Invalide, négatif ou inconnu | UNKNOWN | false |

Le seuil de cinq unités reprend le contrat d'API existant. Une valeur `null` ou manquante est un stock inconnu ; elle ne vaut pas zéro. Les données invalides sont représentées par `stock: null` dans la fiche plutôt que restituées telles quelles. Une panne empêchant toute lecture du produit ne permet pas de construire une fiche : elle donne 503 STOCK_UNAVAILABLE.

L'état du produit regroupe ses formats : IN_STOCK si l'un est IN_STOCK, sinon LOW_STOCK si l'un est LOW_STOCK, sinon UNKNOWN si au moins un stock est inconnu, sinon OUT_OF_STOCK. Un produit sans format est OUT_OF_STOCK. Un format au stock connu et positif reste commandable si un autre format est inconnu.

Le booléen du produit ou du format dans le catalogue et la fiche concerne **une unité**. Pour une quantité précise, utiliser le contrôle ci-dessous. La quantité commandée est distincte du grammage du format.

Le modèle actuel n'a pas de statut de retrait de vente ou d'archivage du produit/format. Ce changement n'invente pas de statut supplémentaire. Si ces règles sont introduites, le service devra les appliquer avant d'autoriser une commande.

## Contrôle public d'une quantité

```text
GET /api/products/{id}/formats/{formatId}/availability?quantity=3
```

Les deux identifiants sont des UUID v4. Le format doit appartenir au produit demandé. `quantity` est un entier de 1 à 99, par défaut 1. Les paramètres inconnus, les quantités répétées, les valeurs vides, décimales, négatives ou en notation scientifique sont refusés.

Exemple de réponse si cinq unités sont en stock :

```json
{
  "productId": "11111111-1111-4111-8111-111111111111",
  "formatId": "22222222-2222-4222-8222-222222222222",
  "quantity": 3,
  "availability": "LOW_STOCK",
  "isOrderable": true
}
```

Pour une demande de six unités sur ce format, la réponse est 200 avec `availability: LOW_STOCK` et `isOrderable: false` : le format est disponible, mais la quantité complète ne l'est pas.

| HTTP | Résultat |
|---|---|
| 200 | État courant et commandabilité de la quantité ; peut indiquer false |
| 400 VALIDATION_ERROR | Identifiant ou quantité invalide, paramètre inconnu |
| 404 NOT_FOUND | Format ou produit absent, ou format appartenant à un autre produit |
| 503 STOCK_UNAVAILABLE | Stock illisible ou invalide ; aucun accord de commandabilité |

La consultation est publique et ne crée aucune réservation. Une réponse positive peut devenir obsolète dès que le stock change.

## Contrôle lors des futures écritures de panier

`ProductsModule` exporte `AvailabilityService`. Le service expose :

```ts
await availabilityService.assertOrderable(productId, formatId, desiredQuantity);
```

Cette méthode relit la base à chaque appel, valide également les quantités de ses appelants internes et retourne le format courant si la quantité complète est disponible. En cas de stock insuffisant, elle lève 409 OUT_OF_STOCK ; en cas de stock non consultable, 503 STOCK_UNAVAILABLE. Les erreurs ne contiennent ni requête SQL ni secret de connexion.

Lorsqu'un appelant dispose déjà d'une transaction, il peut transmettre son `EntityManager` en quatrième argument : la vérification voit alors les changements de cette transaction.

Le module panier n'est pas encore implémenté dans ce dépôt. Ses futurs ajouts et modifications devront contrôler le propriétaire du panier, déterminer la quantité finale de la ligne, puis appeler ce service. Le test de rupture entre consultation et tentative d'ajout est donc une simulation du consommateur panier : consultation HTTP, mise à zéro du stock PostgreSQL, puis appel au contrôle serveur exporté. Il ne constitue pas une validation de bout en bout d'une route panier livrée.

Le contrôle ne décrémente, ne réserve et ne verrouille pas le stock. La commande devra contrôler et réserver atomiquement le stock dans sa propre transaction afin d'empêcher la survente. Un simple contrôle préalable ne remplace pas cette réservation.

## Vérification locale

1. Ouvrir `/api/products`, puis la fiche `/api/products/{id}`.
2. Comparer deux formats de la fiche : un format à zéro doit être OUT_OF_STOCK/false, un format positif LOW_STOCK ou IN_STOCK/true.
3. Copier leurs UUID et appeler la route de contrôle avec une quantité disponible, puis une quantité trop élevée.
4. Vérifier les réponses et schémas dans Swagger : http://localhost:3000/api/docs.

Les tests unitaires couvrent les seuils, les stocks invalides, l'agrégation et le refus serveur. Les tests HTTP utilisent un vrai PostgreSQL et une base dédiée finissant par `_test` ; ils couvrent les formats d'un même produit, la rupture après consultation, les quantités interdites, l'appartenance format/produit, la transaction du consommateur et les pannes de lecture simulées. Ne jamais utiliser la base de développement pour ces fixtures.

La revue du code, le branchement dans les futures écritures du panier, le parcours frontend et la validation en préproduction restent nécessaires avant la clôture complète de la story.
