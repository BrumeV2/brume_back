# Brume — API (brume-api)

Backend de **Brume** (anciennement « Buée »), site e-commerce de thé, café et CBD.
Le front est dans un repo séparé (`brume-front`). Ce repo ne contient que l'API.

## Stack

- NestJS 11 (TypeScript), Node 22
- PostgreSQL 17 + TypeORM (migrations, **jamais** `synchronize: true`)
- pgAdmin pour l'inspection de la base
- Tout tourne dans Docker Compose : `api` (target `dev`, hot reload), `postgres`, `pgadmin`
- Validation : `class-validator` / `class-transformer`, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- Config : `@nestjs/config` (global) + `.env` (voir `.env.example`)

## Commandes

```bash
docker compose up -d --build          # lancer la stack
docker compose up -d --build -V       # après ajout d'une dépendance npm
docker compose logs -f api

# Migrations (le chemin/nom de la migration est obligatoire pour generate/create)
docker compose exec api npm run migration:generate -- src/database/migrations/CreateProducts
docker compose exec api npm run migration:create -- src/database/migrations/SeedCategories
docker compose exec api npm run migration:run
docker compose exec api npm run migration:revert
docker compose exec api npm run migration:show

docker compose exec api npx nest g resource modules/<nom> --no-spec
```

- API : http://localhost:3000/api (préfixe global `api`), healthcheck `GET /api/health`
- pgAdmin : http://localhost:5050 (admin@brume.dev / admin), serveur host = `postgres`, port 5432
- Dans Docker, `DB_HOST=postgres` (surchargé dans le compose) ; hors Docker, `localhost`

## Structure

```
src/
├── database/
│   ├── data-source.ts      # DataSource pour la CLI TypeORM (charge .env via dotenv)
│   └── migrations/
├── modules/                # (à créer) un module par domaine métier (≈ Epics du backlog)
│   ├── products/ categories/ stock/      # Epic 01 Catalogue & Produits
│   ├── search/                           # Epic 02 Recherche & Découverte
│   ├── cart/ orders/ checkout/           # Epic 03 Panier & Commande
│   ├── payments/                         # Epic 04 Paiement
│   ├── subscriptions/                    # Epic 05 Abonnements
│   ├── auth/ users/                      # Epic 06 Compte Client
│   ├── shipping/                         # Epic 07 Livraison
│   ├── loyalty/ tournament/              # Epic 08 Fidélisation & Gamification
│   ├── marketing/ (newsletter, promos, gift-cards)  # Epic 09
│   ├── reviews/                          # Epic 10 Avis
│   ├── support/                          # Epic 11 Support Client
│   ├── content/ (blog, faq)              # Epic 12 Contenu & Événements
│   └── admin/                            # Epic 13 Administration
├── app.controller.ts       # GET /api/health
├── app.module.ts
└── main.ts
```

## Conventions de code

- Montants en **centimes (integer)**, jamais en float (`priceCents`, `totalCents`…)
- Clés primaires UUID (`@PrimaryGeneratedColumn('uuid')`)
- `createdAt` / `updatedAt` sur toutes les entités
- Les prix, remises, frais de port et totaux sont **toujours calculés côté serveur** ; ne jamais faire confiance à un montant envoyé par le front
- Stock vérifié côté API à chaque ajout panier, modification et création de commande
- Les lignes de commande **gèlent** le prix au moment de la commande
- Produits archivés plutôt que supprimés (`archived`) pour conserver l'historique
- DTO validés avec class-validator pour toute entrée
- Toute modification de schéma = une migration générée et committée

## Workflow Git / Jira

- Branche principale : `main`
- Backlog dans Jira : Epic → (Feature) → Story `[US-0XX] Titre` → Sub-tasks `[US-0XX][BACK]` / `[US-0XX][FRONT]`
- Branches : `feature/<CLÉ-JIRA>-description-courte` (la clé Jira, ex. `BRUME-42`, doit apparaître dans la branche, les commits et la MR pour le lien GitLab ↔ Jira)
- Priorités : P0 = MVP, P1 = V1, P2 = V2, P3 = plus tard
- Backlog complet : 86 US (`docs/backlog.pdf` — pas encore ajouté au repo)

## Périmètre MVP (P0) — à faire en priorité

Catalogue, fiche produit, catégories, disponibilité/stock, recherche par nom, filtres, panier (ajout, quantité, suppression, total), checkout (adresse, mode de livraison, récapitulatif), commande + confirmation, paiement en ligne (+ échec, confirmation, webhooks), inscription/connexion, profil, historique de commandes, back-office produits/commandes/stock.

## Langage métier

| Terme | Définition |
|---|---|
| TEA-BOX Découverte | Box créée par l'entreprise, achat ponctuel |
| TEA-BOX Sélection | Abonnement mensuel, contenu choisi par l'entreprise |
| TEA-BOX Custom | Box composée par le client, récurrente |
| TEA-BOX Tournoi | Box liée à la Bataille des Mélanges |
| TeaOMatic | Configurateur de mélange perso (base, ingrédients, proportions, nom) |
| TeaTouan | Personnage virtuel de fidélisation (XP, niveaux, récompenses) |
| Bataille des Mélanges | Tournoi mensuel de dégustation et de vote |
| Calendrier de l'Avent | Produit **physique** saisonnier : 24 produits, un par jour |

## État actuel

- [x] Projet NestJS initialisé, Docker Compose (api + postgres + pgadmin), Dockerfile multi-stage, `.dockerignore`
- [x] TypeORM configuré (`app.module.ts` + `data-source.ts` + scripts `migration:*`)
- [x] `main.ts` : préfixe `api`, CORS, ValidationPipe ; healthcheck `GET /api/health`
- [x] `.env.example`
- [ ] Premier commit
- [ ] `docs/backlog.pdf` dans le repo
- [ ] Modèle de données MVP (produits, catégories, users, panier, commandes)
- [ ] Auth (inscription bcrypt + JWT) — US-045 / US-046
- [ ] Migrations en CI GitLab pour la prod (la `data-source.ts` pointe sur `src/**/*.ts` : prévoir une variante `dist/` pour l'image prod)
