<div align="center">

# 🍃 Brume — API

**Backend de Brume, boutique en ligne de thé, café et CBD.**

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-migrations-FE0803)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

</div>

---

## Sommaire

- [À propos](#-à-propos)
- [Stack technique](#-stack-technique)
- [Démarrage rapide](#-démarrage-rapide)
- [Variables d'environnement](#-variables-denvironnement)
- [Commandes utiles](#-commandes-utiles)
- [Structure du projet](#-structure-du-projet)
- [Conventions](#-conventions)
- [Workflow Git](#-workflow-git)
- [Roadmap](#-roadmap)

---

## 📖 À propos

Brume vend du thé, du café et du CBD en ligne, avec en plus quelques produits maison :

| Concept | Description |
|---|---|
| **TEA-BOX** | Box *Découverte* (achat unique), *Sélection* (abonnement mensuel), *Custom* (composée par le client) et *Tournoi* |
| **TeaOMatic** | Configurateur de mélange perso : base, ingrédients, proportions et nom |
| **TeaTouan** | Personnage virtuel de fidélité qui gagne de l'XP, monte de niveau et débloque des récompenses |
| **Bataille des Mélanges** | Tournoi mensuel de dégustation où les clients votent |
| **Calendrier de l'Avent** | Coffret physique saisonnier de 24 produits, un par jour |

Ce dépôt ne contient **que l'API**. Le front est dans le dépôt `brume-front`.

---

## 🧰 Stack technique

- **Framework** : [NestJS 11](https://nestjs.com/) (TypeScript), Node 22
- **Base de données** : PostgreSQL 17 + [TypeORM](https://typeorm.io/), schéma géré **uniquement par migrations**
- **Validation** : `class-validator` / `class-transformer` avec un `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- **Configuration** : `@nestjs/config` + fichier `.env`
- **Environnement** : Docker Compose (`api` avec hot reload, `postgres`, `pgadmin`)

---

## 🚀 Démarrage rapide

**Prérequis :** [Docker Desktop](https://www.docker.com/products/docker-desktop/) et Git.

```bash
# 1. Cloner le dépôt
git clone https://github.com/YBrume/brume_backend.git
cd brume_backend

# 2. Créer le fichier d'environnement
cp .env.example .env

# 3. Lancer la stack (API + PostgreSQL + pgAdmin)
docker compose up -d --build

# 4. Appliquer les migrations
docker compose exec api npm run migration:run
```

Une fois la stack lancée :

| Service | URL | Infos |
|---|---|---|
| 🌐 API | http://localhost:3000/api | préfixe global `/api` |
| 📚 Swagger | http://localhost:3000/api/docs | spec JSON : `/api/docs-json` |
| ❤️ Healthcheck | http://localhost:3000/api/health | |
| 🐘 PostgreSQL | `localhost:5432` | identifiants définis dans `.env` |
| 🛠️ pgAdmin | http://localhost:5050 | `admin@brume.dev` / `admin` |

> **Connexion à la base dans pgAdmin :** host = `postgres`, port = `5432`, avec l'utilisateur et le mot de passe du `.env`.

---

## 🔐 Variables d'environnement

Le modèle se trouve dans [`.env.example`](.env.example). Le fichier `.env` n'est **jamais** commité.

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute de l'API |
| `DB_HOST` | `localhost` | Remplacé par `postgres` dans Docker |
| `DB_PORT` | `5432` | Port PostgreSQL |
| `DB_USER` | `brume` | Utilisateur PostgreSQL |
| `DB_PASSWORD` | `change-me` | Mot de passe PostgreSQL |
| `DB_NAME` | `brume` | Nom de la base |
| `CORS_ORIGIN` | *(vide)* | Origines autorisées, séparées par des virgules. Vide = toutes (dev) |

---

## ⌨️ Commandes utiles

### Docker

```bash
docker compose up -d --build        # lancer / reconstruire la stack
docker compose up -d --build -V     # après l'ajout d'une dépendance npm
docker compose logs -f api          # suivre les logs de l'API
docker compose down                 # arrêter la stack
```

### Migrations TypeORM

```bash
# Générer une migration à partir des entités
docker compose exec api npm run migration:generate -- src/database/migrations/CreateProducts

# Créer une migration vide (ex. seed)
docker compose exec api npm run migration:create -- src/database/migrations/SeedCategories

docker compose exec api npm run migration:run      # appliquer
docker compose exec api npm run migration:revert   # annuler la dernière
docker compose exec api npm run migration:show     # voir l'état
```

### Développement

```bash
docker compose exec api npx nest g resource modules/<nom> --no-spec   # nouveau module
docker compose exec api npm run lint                                  # lint
docker compose exec api npm run test                                  # tests unitaires
docker compose exec api npm run test:e2e                              # tests e2e
```

---

## 🗂️ Structure du projet

```
src/
├── database/
│   ├── data-source.ts      # DataSource utilisée par la CLI TypeORM
│   └── migrations/         # migrations versionnées
├── modules/                # un module par domaine métier (à venir)
├── app.controller.ts       # GET /api/health
├── app.module.ts
└── main.ts                 # préfixe /api, CORS, ValidationPipe
```

---

## 📏 Conventions

- 💶 **Montants en centimes (integer)**, jamais en float : `priceCents`, `totalCents`…
- 🧮 Prix, remises, frais de port et totaux **toujours calculés côté serveur**. Un montant envoyé par le front n'est jamais pris tel quel.
- 📦 Le **stock est vérifié** à chaque ajout au panier, à chaque modification et à chaque création de commande.
- 🧊 Les lignes de commande **gèlent le prix** au moment de l'achat.
- 🗄️ Les produits sont **archivés** (`archived`) au lieu d'être supprimés.
- 🔑 Les clés primaires sont des **UUID**, et chaque entité a `createdAt` / `updatedAt`.
- ✅ Toute entrée passe par un **DTO validé** avec class-validator.
- 🧬 Chaque changement de schéma passe par une **migration générée et commitée** (jamais de `synchronize: true`).

---

## 🌿 Workflow Git

- Branche principale : `main`
- Branches de travail : `feature/<CLÉ-JIRA>-description-courte`, par exemple `feature/BRUME-42-catalogue-produits`
- La **clé Jira** doit apparaître dans le nom de la branche, dans les commits et dans la PR.
- Organisation du backlog Jira : Epic → Story `[US-0XX]` → Sub-tasks `[BACK]` / `[FRONT]`
- Priorités : **P0** = MVP · **P1** = V1 · **P2** = V2 · **P3** = plus tard

---

## 🗺️ Roadmap

### MVP (P0)

- [x] Initialisation NestJS, Docker Compose, TypeORM et healthcheck
- [ ] Catalogue, fiche produit, catégories, stock
- [ ] Recherche par nom et filtres
- [ ] Panier : ajout, quantité, suppression, total
- [ ] Checkout : adresse, mode de livraison, récapitulatif
- [ ] Commande et confirmation
- [ ] Paiement en ligne : succès, échec, webhooks
- [ ] Inscription et connexion (bcrypt + JWT), profil, historique de commandes
- [ ] Back-office : produits, commandes, stock

### Ensuite

Abonnements TEA-BOX · Fidélité TeaTouan · Bataille des Mélanges · Marketing (newsletter, promos, cartes cadeaux) · Avis · Support client · Blog & FAQ

---

<div align="center">
<sub>Fait avec 🍵 par l'équipe Brume</sub>
</div>
