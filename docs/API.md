# Contrat d'API — MVP (T-003)

> **Source de vérité** : [`contract/openapi.yaml`](contract/openapi.yaml) (D-018). Ce document en explique les règles.
> Modèle de données : [`DATA-MODEL.md`](DATA-MODEL.md). Décisions : [`DECISIONS.md`](DECISIONS.md).

## Utiliser le contrat côté front (développement en parallèle)

```bash
# Mock de l'API à partir du contrat (réponses = exemples du contrat)
# ⚠️ URL de base du mock : http://localhost:4010 (SANS /api) — vs http://localhost:3000/api pour la vraie API
npx @stoplight/prism-cli@5 mock docs/contract/openapi.yaml

# Forcer une réponse d'erreur précise depuis le front (header Prefer) :
#   Prefer: code=409, example=priceChanged

# Prévisualiser la doc
npx @redocly/cli@1 preview-docs docs/contract/openapi.yaml

# Générer les types TypeScript du front à partir du contrat
npx openapi-typescript@7 docs/contract/openapi.yaml -o src/api/schema.d.ts
```

- [`contract/seed.json`](contract/seed.json) est le **jeu de données de référence** (catégories, produits, variantes, livraison, comptes de test, une commande payée). Le front s'en sert pour ses fixtures. Le back le chargera via une migration de seed.
- Pour le back, `GET /api/docs-json` (Swagger généré) doit rester **conforme** à `openapi.yaml`. Un test de conformité sera ajouté en CI.

## Conventions

| Sujet | Règle |
|---|---|
| URL de base | `/api` ; routes back-office sous `/api/admin/…` |
| Format | JSON, `camelCase` |
| Identifiants | UUID v4 |
| Dates | ISO 8601 en UTC (`2026-10-09T14:30:00.000Z`) |
| Montants | **entiers en centimes**, suffixe `Cents`, toujours en EUR. Le front ne recalcule jamais un total |
| Taux | entiers en points de base, suffixe `Bps` |
| Pagination | `?page=1&limit=20` (`limit` ≤ 100) → `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }` |
| Tri | `?sort=price_asc` (valeurs listées par route) |
| Création | `201` + ressource créée ; suppression `204` sans corps |
| Idempotence | `POST /orders` accepte un header `Idempotency-Key` (UUID) : renvoyer la même clé renvoie la même commande, sans doublon |

## Authentification et contrôle d'accès

- `POST /auth/login` et `POST /auth/register` renvoient un `accessToken` (JWT, 15 min) et posent un cookie `refresh_token` httpOnly (D-019).
- Les routes protégées attendent le header `Authorization: Bearer <accessToken>`.
- Sur une `401` avec le code `TOKEN_EXPIRED`, le front appelle `POST /auth/refresh` puis rejoue la requête.

| Rôle | Accès |
|---|---|
| **Public** (sans jeton) | catalogue, catégories, modes de livraison, inscription/connexion, webhook Stripe (signature vérifiée) |
| **CUSTOMER** | son profil, son panier, ses commandes et ses paiements, uniquement **ses propres** ressources |
| **ADMIN** | tout ce que fait CUSTOMER + toutes les routes `/admin/**` |

- Une ressource qui appartient à un autre client renvoie **`404`** et pas `403`, pour ne pas révéler qu'elle existe.
- Une route `/admin/**` appelée sans le rôle ADMIN renvoie `403 FORBIDDEN`.
- Côté code : `JwtAuthGuard` global avec `@Public()` pour les exceptions, et `RolesGuard` avec `@Roles(Role.ADMIN)`.

## Format d'erreur

Toutes les erreurs ont la même forme. Le filtre global `HttpExceptionFilter` convertit aussi les erreurs du `ValidationPipe` dans ce format :

```json
{
  "statusCode": 409,
  "code": "OUT_OF_STOCK",
  "message": "Stock insuffisant pour 1 article.",
  "details": [{ "variantId": "…", "sku": "EG-100G", "requested": 3, "available": 1 }],
  "path": "/api/orders",
  "timestamp": "2026-10-09T14:30:00.000Z"
}
```

Le front se base sur `code`, qui est stable. `message` est un texte en français, lisible mais susceptible de changer.

### Catalogue des codes d'erreur

| HTTP | `code` | Quand | `details` |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO invalide | `[{ field, constraints[] }]` |
| 400 | `WEBHOOK_SIGNATURE_INVALID` | signature Stripe incorrecte | — |
| 401 | `UNAUTHENTICATED` | jeton absent ou invalide | — |
| 401 | `TOKEN_EXPIRED` | access token expiré : il faut appeler `/auth/refresh` | — |
| 401 | `INVALID_CREDENTIALS` | email ou mot de passe incorrect (message volontairement vague) | — |
| 403 | `FORBIDDEN` | rôle insuffisant | — |
| 404 | `NOT_FOUND` | ressource inexistante, archivée côté public, ou appartenant à un autre client | — |
| 409 | `EMAIL_ALREADY_USED` | inscription avec un email existant | — |
| 409 | `OUT_OF_STOCK` | ajout au panier, modification ou création de commande au-delà du stock | `[{ variantId, sku, requested, available }]` |
| 409 | `PRODUCT_UNAVAILABLE` | variante ou produit archivé | `[{ variantId, sku }]` |
| 409 | `PRICE_CHANGED` | `expectedTotalCents` différent du total recalculé | `{ expectedTotalCents, actualTotalCents }` |
| 409 | `INVALID_ORDER_TRANSITION` | changement de statut non autorisé | `{ from, to, allowed[] }` |
| 409 | `ORDER_NOT_PAYABLE` | paiement d'une commande qui n'est pas `PENDING_PAYMENT` | `{ status }` |
| 409 | `IDEMPOTENCY_KEY_REUSED` | même `Idempotency-Key` avec un corps de requête différent | — |
| 410 | `RESERVATION_EXPIRED` | paiement tenté après expiration de la réservation (D-011) | — |
| 422 | `CART_EMPTY` | création de commande avec un panier vide | — |
| 422 | `SHIPPING_ZONE_NOT_SERVED` | adresse hors France métropolitaine continentale (D-003) | `{ postalCode, country }` |
| 422 | `SHIPPING_METHOD_UNAVAILABLE` | mode de livraison inconnu ou inactif | — |
| 422 | `AGE_DECLARATION_REQUIRED` | panier avec du CBD sans `ageDeclaration: true` (D-002) | `[{ sku }]` |
| 429 | `RATE_LIMITED` | trop de tentatives (login, inscription) | — |
| 502 | `PAYMENT_PROVIDER_ERROR` | Stripe indisponible ou en erreur | — |

## Routes du MVP

| Méthode | Route | Accès | US |
|---|---|---|---|
| GET | `/health` | public | — |
| **Auth** | | | |
| POST | `/auth/register` | public | 045 |
| POST | `/auth/login` | public | 046 |
| POST | `/auth/refresh` | cookie | 046 |
| POST | `/auth/logout` | cookie | 046 |
| **Compte** | | | |
| GET / PATCH | `/users/me` | CUSTOMER | 047 |
| GET / POST | `/users/me/addresses` | CUSTOMER | 048 (P1) |
| PATCH / DELETE | `/users/me/addresses/{id}` | CUSTOMER | 048 (P1) |
| **Catalogue** | | | |
| GET | `/categories` | public | 003 |
| GET | `/products` (`q`, `category`, `type`, `minPriceCents`, `maxPriceCents`, `inStock`, `sort`, `page`, `limit`) | public | 001, 014, 016, 017 |
| GET | `/products/{slug}` | public | 002, 004 |
| **Panier** | | | |
| GET / DELETE | `/cart` | CUSTOMER | 024 |
| POST | `/cart/items` | CUSTOMER | 021 |
| PATCH / DELETE | `/cart/items/{itemId}` | CUSTOMER | 022, 023 |
| POST | `/cart/merge` | CUSTOMER | 021 (D-017) |
| **Checkout et commandes** | | | |
| GET | `/shipping-methods` | public | 027, 052 |
| POST | `/checkout/quote` | CUSTOMER | 025, 026, 027, 028 |
| POST | `/orders` | CUSTOMER | 029, 033 |
| GET | `/orders` | CUSTOMER | 050 |
| GET | `/orders/{id}` | CUSTOMER | 030, 031, 035 |
| POST | `/orders/{id}/payment-session` | CUSTOMER | 034 (réessayer) |
| POST | `/orders/{id}/cancel` | CUSTOMER | — |
| **Paiement** | | | |
| POST | `/payments/stripe/webhook` | public + signature | 033, 034, 035 |
| **Back-office** | | | |
| GET / POST | `/admin/categories` | ADMIN | — |
| PATCH | `/admin/categories/{id}` | ADMIN | — |
| GET / POST | `/admin/products` | ADMIN | 080 |
| GET / PATCH | `/admin/products/{id}` | ADMIN | 081 |
| POST | `/admin/products/{id}/archive` | ADMIN | 082 |
| POST | `/admin/products/{id}/variants` | ADMIN | 080 |
| PATCH | `/admin/variants/{id}` | ADMIN | 081 |
| POST | `/admin/variants/{id}/stock-adjustments` | ADMIN | 005 |
| GET | `/admin/orders` (`status`, `q`, `page`) | ADMIN | 083 |
| GET | `/admin/orders/{id}` | ADMIN | 083 |
| POST | `/admin/orders/{id}/transitions` | ADMIN | 083 |

### Le parcours d'achat, pas à pas

```
Front                                   API                                  Stripe
  │ POST /checkout/quote ───────────────▶│ recalcule tout, aucun effet de bord
  │◀──────────── récapitulatif (US-028) ─│
  │ POST /orders  (Idempotency-Key,      │
  │   expectedTotalCents = total affiché)│
  │                                      │─ transaction : vérifie stock, gèle les prix,
  │                                      │  réserve le stock, crée Order PENDING_PAYMENT
  │                                      │─ crée Checkout Session ──────────────▶│
  │◀──── 201 { order, checkoutUrl } ─────│
  │ redirection vers checkoutUrl ──────────────────────────────────────────────▶│
  │                                      │◀──── webhook checkout.session.completed
  │                                      │─ Payment SUCCEEDED, Order PAID, panier vidé, email
  │◀──────────── retour sur /commande/{id}?session_id=… ─────────────────────────│
  │ GET /orders/{id} (polling court       │
  │   tant que PENDING_PAYMENT)           │
```

- `expectedTotalCents` **ne fixe pas** le prix : l'API recalcule tout et, si le résultat est différent, renvoie `409 PRICE_CHANGED`. Le front affiche alors le nouveau récapitulatif.
- La page de retour ne déclenche aucune action. Elle relit la commande, dont le statut ne change que par webhook.

## États commande et paiement

### Commande (`OrderStatus`) : voir D-012

| De ↓ / Vers → | PENDING_PAYMENT | PAID | PREPARING | SHIPPED | DELIVERED | CANCELLED |
|---|---|---|---|---|---|---|
| *(création)* | ✅ client | | | | | |
| PENDING_PAYMENT | | ✅ webhook | | | | ✅ expiration · client · admin |
| PAID | | | ✅ admin | | | ✅ admin (+ remboursement total) |
| PREPARING | | | | ✅ admin | | ✅ admin (+ remboursement total) |
| SHIPPED | | | | | ✅ admin | |
| DELIVERED | | | | | | |
| CANCELLED | | | | | | |

`DELIVERED` et `CANCELLED` sont **terminaux**. Toute autre transition renvoie `409 INVALID_ORDER_TRANSITION`.

### Paiement (`PaymentStatus`) : une ligne par tentative

| De | Vers | Déclencheur Stripe |
|---|---|---|
| *(création)* | `PENDING` | `POST /orders` ou `POST /orders/{id}/payment-session` |
| `PENDING` | `SUCCEEDED` | `checkout.session.completed` (avec `payment_status = paid`) |
| `PENDING` | `FAILED` | `checkout.session.async_payment_failed` / paiement refusé |
| `PENDING` | `EXPIRED` | `checkout.session.expired` ou expiration de la réservation |

Les remboursements (`Refund`) sont suivis à part. `Order.refundedCents` cumule ceux qui ont réussi.

### Cohérence entre commande et paiement

Ces règles sont vérifiées par des tests et ne doivent jamais être violées :

| # | Invariant |
|---|---|
| I-1 | `Order.status = PENDING_PAYMENT` ⇒ aucun `Payment` `SUCCEEDED`, au plus un `Payment` `PENDING` |
| I-2 | `Order.status ∈ {PAID, PREPARING, SHIPPED, DELIVERED}` ⇒ **exactement un** `Payment` `SUCCEEDED`, avec `amountCents = Order.totalCents` |
| I-3 | `Order.status = CANCELLED` et `paidAt` renseigné ⇒ remboursements réussis = `totalCents` (`refundedCents = totalCents`) |
| I-4 | `Order.status = CANCELLED` et `paidAt` vide ⇒ aucun `Payment` `SUCCEEDED`, stock réintégré (`RELEASE`) |
| I-5 | Un paiement réussi qui arrive sur une commande déjà `CANCELLED` (course avec l'expiration) déclenche un **remboursement automatique**. La commande reste `CANCELLED` |
| I-6 | Un `providerEventId` n'est traité qu'une fois (`PaymentEvent`) |
| I-7 | `0 ≤ refundedCents ≤ totalCents` |

## Évolution du contrat

- Ajouter un champ ou une route : compatible, il suffit d'une MR qui modifie `openapi.yaml` et ce document.
- Renommer, supprimer ou changer un type : non compatible. Il faut prévenir le front dans la MR et livrer les deux dépôts ensemble.
- La version du contrat (`info.version`) suit SemVer : mineure pour un ajout, majeure pour un changement non compatible.
