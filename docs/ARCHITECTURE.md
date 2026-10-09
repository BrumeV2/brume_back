# Architecture — brume-api

> Ce document est la **référence** : l'arborescence ci-dessous est la cible, pas l'existant.
> Un module n'est créé **qu'au moment où on attaque son US** (voir [Créer un module](#créer-un-module)).
> Si un choix change, on met à jour ce document dans la même MR.

## Principe : un module NestJS par domaine métier

L'API est un **monolithe modulaire**. Chaque domaine (produits, panier, commandes…) est un module autonome dans `src/modules/`. Les modules ne se parlent qu'en important le **service** d'un autre module (exporté dans son `*.module.ts`), jamais en accédant directement à ses entités ou repositories.

```
src/
├── main.ts                     # bootstrap : préfixe /api, CORS, ValidationPipe, Swagger
├── app.module.ts               # importe tous les modules
├── config/                     # config typée (DB, JWT, Swagger) + validation du .env
├── common/                     # transverse, sans logique métier
│   ├── entities/base.entity.ts # id UUID + createdAt + updatedAt (toutes les entités en héritent)
│   ├── enums/role.enum.ts      # CUSTOMER | ADMIN
│   ├── decorators/             # @CurrentUser(), @Roles(), @Public()
│   ├── guards/                 # JwtAuthGuard (global), RolesGuard
│   ├── filters/                # format d'erreur uniforme
│   ├── dto/                    # pagination
│   └── utils/money.util.ts     # calculs en centimes
├── infrastructure/             # adaptateurs vers l'extérieur
│   └── mail/                   # envoi d'emails (confirmation, expédition…)
├── database/
│   ├── data-source.ts
│   └── migrations/
└── modules/                    # un dossier par domaine (voir tableau plus bas)
```

## Anatomie d'un module

```
modules/orders/
├── orders.module.ts            # déclare, importe, exporte
├── orders.controller.ts        # routes client       → /api/orders
├── admin-orders.controller.ts  # routes back-office  → /api/admin/orders  (@Roles(ADMIN))
├── orders.service.ts           # TOUTE la logique métier
├── entities/                   # entités TypeORM (héritent de BaseEntity)
│   ├── order.entity.ts
│   └── order-item.entity.ts
├── dto/                        # entrées validées (class-validator)
└── enums/                      # statuts, types…
```

## Créer un module

```bash
docker compose exec api npx nest g resource modules/<nom> --no-spec
```

Puis l'adapter à ce document :
- les entités héritent de `BaseEntity` et utilisent des montants en centimes ;
- les routes admin passent dans un `admin-<nom>.controller.ts` séparé ;
- on supprime ce que le générateur a créé et dont on n'a pas besoin ;
- on génère la migration : `npm run migration:generate -- src/database/migrations/<Nom>`.

## Règles

1. **Controller = fin.** Il valide (DTO), récupère l'utilisateur (`@CurrentUser()`) et délègue au service. Aucune logique métier.
2. **Le service porte le métier** : calcul des prix, vérification du stock, transitions de statut.
3. **Pas de module `admin` fourre-tout.** Les routes back-office d'un domaine vivent **dans ce domaine**, dans un `admin-<domaine>.controller.ts` préfixé `admin/` et protégé par `@Roles(Role.ADMIN)`. Le module `admin/` ne contient que le dashboard (indicateurs transverses).
4. **Auth par défaut.** `JwtAuthGuard` est global ; les routes publiques (catalogue, FAQ, blog…) sont marquées `@Public()`.
5. **Argent en centimes**, calculé côté serveur uniquement (`common/utils/money.util.ts`).
6. **Transactions** pour toute opération qui touche plusieurs tables (création de commande = commande + lignes + décrément de stock + vidage du panier).
7. **Fournisseurs externes derrière une interface** (ex. `payments/providers/payment-provider.interface.ts`) pour pouvoir changer de PSP ou mocker en test.
8. **Une migration par changement de schéma**, jamais `synchronize`.
9. **Pas de fichier vide « pour plus tard »** : on crée un fichier quand on écrit son code.

## Modélisation clé

- **Produit polymorphe** : `Product.type` = `TEA | COFFEE | CBD | BOX | ADVENT_CALENDAR`.
  Une TEA-BOX Découverte et le Calendrier de l'Avent sont des **produits** dont le contenu est décrit par `ProductComponent` (produit parent → produits enfants + quantité). Ils passent donc par le même panier, les mêmes commandes et le même stock — pas besoin de module dédié.
- **Stock** : quantité sur le produit + journal `StockMovement` (entrée, vente, ajustement, retour) pour l'historique.
- **Commande** : `OrderItem` copie le nom et le prix unitaire au moment de l'achat (prix gelé). L'adresse de livraison est copiée dans la commande (pas de FK vers `Address`, qui peut changer).
- **Mélange TeaOMatic** (`Blend`) : entité propre, ajoutable au panier (`CartItem` référence soit un `Product`, soit un `Blend`).
- **Recherche / filtres / tri** : pas de module `search`, c'est `GET /api/products?q=&category=&sort=` via un `ProductQueryDto`.

## Correspondance Epics / US → modules

| Epic | Module(s) | US |
|---|---|---|
| 01 Catalogue & Produits | `products`, `categories`, `stock`, `blends` (TeaOMatic) | 001-005 · 006-007 (BOX) · 008-013 (TeaOMatic) |
| 02 Recherche & Découverte | `products` (recherche, filtres, tri), `recommendations` | 014-017 · 018-020 |
| 03 Panier & Commande | `cart`, `checkout`, `orders` | 021-024 · 025-028 · 029-032 |
| 04 Paiement | `payments` (+ webhook) | 033-035 · 036-037 (remboursements) · 038 |
| 05 Abonnements | `subscriptions` | 039-044 |
| 06 Compte Client | `auth`, `users` (profil, adresses, favoris) | 045-046 · 047-048, 051 · 049-050 |
| 07 Livraison | `shipping` (+ `infrastructure/mail`) | 052-054 |
| 08 Fidélisation & Gamification | `loyalty` (TeaTouan), `tournament` | 055-057 · 058-061 |
| 09 Marketing | `newsletter`, `promotions`, `gift-cards` | 062-063 · 064 · 065-066 |
| 10 Avis & Communauté | `reviews` | 067-069 |
| 11 Support Client | `faq`, `support` | 070 · 071-073 |
| 12 Contenu & Événements | `blog`, `products` (type `ADVENT_CALENDAR`) | 074-075 · 076-078 |
| 13 Administration | `admin` (dashboard) + `admin-*.controller.ts` de chaque module | 079 · 080-086 |

## Ordre de construction conseillé (MVP)

1. `common/` (BaseEntity, rôles, guards) + `auth` / `users` — US-045, 046, 047
2. `categories` / `products` / `stock` — US-001 à 005, 014, 016, 080, 081
3. `cart` — US-021 à 024
4. `shipping` (modes de livraison uniquement) + `checkout` — US-025 à 028, 052
5. `orders` — US-029 à 031, 050, 083
6. `payments` + webhook — US-033 à 035
7. `infrastructure/mail` — US-030
