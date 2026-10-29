# Environnements, Déploiement et Intégration Continue (CI/CD)

Ce document décrit l'architecture des environnements, la configuration de l'infrastructure sur la machine virtuelle, la chaîne de livraison continue (CI/CD) et les protocoles opérationnels de déploiement et de maintenance.

---

## 1. Architecture Globale

La plateforme Brume est hébergée sur une machine virtuelle Linux (Ubuntu) accessible au sein du réseau sécurisé de l'établissement (10.2.192.7).

```mermaid
flowchart TD
    client["Client Web (Navigateur)"] -->|HTTPS :443| caddy["Caddy (Reverse Proxy & TLS)"]
    caddy -->|app.ybrume.duckdns.org| front["Conteneur Front (Nginx / Angular 21)"]
    caddy -->|api.ybrume.duckdns.org| back["Conteneur Back (NestJS 11 / Node 22)"]
    back -->|Port 5432 (Réseau db interne)| postgres[("PostgreSQL 17 (Volume pgdata)")]

    subgraph Reseau Web
        caddy
        front
        back
    end

    subgraph Reseau DB (internal: true)
        back
        postgres
    end
```

### Règles de sécurité réseau
- **Point d'entrée unique :** Seul le conteneur Caddy publie les ports 80 et 443 sur l'hôte.
- **Réseau de base de données isolé :** Le service PostgreSQL est placé sur un réseau Docker interne (`internal: true`) sans passerelle vers l'extérieur ni vers le réseau local. L'accès à la base n'est possible que depuis le conteneur `back`.
- **Terminaison TLS automatique :** Caddy obtient et renouvelle automatiquement les certificats TLS Let's Encrypt via le challenge DNS-01 DuckDNS.

---

## 2. Gestion des Variables d'Environnement et Secrets

Le backend applique une architecture **fail-fast** stricte : l'application refuse de démarrer si une variable requise est manquante, mal formée ou si un secret local est utilisé hors développement.

### Fichier d'environnement sur la VM (`/opt/filrouge/.env`)
Ce fichier réside exclusivement sur la machine virtuelle et ne doit **jamais** être commité dans Git. Les permissions sont restreintes (`chmod 600`, propriétaire `deploy:deploy`).

| Variable | Description | Exemple en préproduction |
|---|---|---|
| `PORT` | Port d'écoute interne de l'API | `3000` |
| `DB_HOST` | Hôte PostgreSQL (nom du service Docker) | `postgres` |
| `DB_PORT` | Port PostgreSQL interne | `5432` |
| `DB_USER` | Utilisateur PostgreSQL | `brume` |
| `DB_PASSWORD` | Mot de passe sécurisé (généré aléatoirement) | *(secret)* |
| `DB_NAME` | Nom de la base de données | `brume` |
| `CORS_ORIGIN` | Origine autorisée (sans slash final) | `https://app.ybrume.duckdns.org` |
| `GOOGLE_CLIENT_ID` | Identifiant de l'application OAuth Google | `155953261790-...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Secret de l'application OAuth Google | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | URI de retour OAuth déclarée chez Google | `https://api.ybrume.duckdns.org/api/auth/google/callback` |
| `AUTH_SUCCESS_URL` | URL de redirection finale après connexion | `https://app.ybrume.duckdns.org/compte` |
| `AUTH_COOKIE_SECURE` | Exige des cookies HTTPS en production | `true` |
| `AUTH_TRUST_PROXY_HOPS` | Nombre de proxys en amont (Caddy = 1) | `1` |

---

## 3. Chaîne CI/CD (GitHub Actions)

### Stratégie de branches
- **Branches de développement (`develop` back / `dev` front) et Pull Requests :**
  - Exécution du job `verify` : ESLint, tests unitaires Jest avec rapport de couverture interactif, compilation.
  - Aucun build Docker ni déploiement n'est déclenché.
- **Branche principale (`main`) :**
  - Validation complète des tests.
  - Construction multi-plateforme Docker (`linux/amd64`).
  - Publication des images sur GitHub Container Registry (`ghcr.io/brumev2/...`).
  - Déploiement automatique sur la VM via le runner auto-hébergé.

### Configuration du Runner sur la Machine Virtuelle
- **Emplacement :** `/opt/filrouge/actions-runner/`
- **Utilisateur système :** `deploy` (groupes `users`, `docker`)
- **Service systemd :** `actions.runner.BrumeV2.filrouge-deploy.service`
- **Configuration Organisation GitHub :**
  - Dans les paramètres de l'organisation `BrumeV2` (`Settings > Actions > Runner groups > Default`), l'option **"Allow public repositories"** est impérativement activée pour permettre l'exécution des jobs sur les dépôts publics du projet.

---

## 4. Authentification Google OAuth (SSO)

L'authentification repose sur Google OAuth 2.0 avec flux Authorization Code + PKCE.

1. **Console Google Cloud :**
   - Application Web déclarée dans Google Cloud Console.
   - **URI de redirection autorisés :** `https://api.ybrume.duckdns.org/api/auth/google/callback`
   - **Origines JavaScript autorisées :** `https://app.ybrume.duckdns.org` et `https://api.ybrume.duckdns.org`
2. **Cycle de vie de la session :**
   - Le clic sur "Connexion avec Google" dirige vers `/api/auth/google`.
   - L'API génère un cookie temporaire sécurisé `brume_oauth` (`HttpOnly`, `Secure`, `SameSite=Lax`).
   - Au retour (`/api/auth/google/callback`), le profil est créé ou retrouvé dans la table `utilisateurs`, et un cookie de session persistant `brume_session` est délivré.
   - Le frontend Angular (`brume_front`) est configuré avec `useMocks: false` en production pour consommer cette API réelle.

---

## 5. Procédures Opérationnelles

### Déploiement automatique
Le déploiement est entièrement automatique lors de chaque fusion sur la branche **`main`**.

### Déploiement manuel sur la machine virtuelle
Pour déployer manuellement ou forcer la mise à jour :
```bash
# Connexion SSH
ssh ynov_brume_vm

# Exécuter le déploiement ciblé
/opt/filrouge/deploy.sh back    # Déploie uniquement le back et joue les migrations
/opt/filrouge/deploy.sh front   # Déploie uniquement le front
/opt/filrouge/deploy.sh all     # Déploie l'ensemble des conteneurs
```

### Consultation des journaux (Logs)
```bash
cd /opt/filrouge
sudo docker compose logs -f back     # Logs en direct du backend
sudo docker compose logs -f front    # Logs du frontend
sudo docker compose logs -f caddy    # Logs du reverse proxy
sudo docker compose ps               # État de santé des conteneurs
```

### Procédure de Retour Arrière (Rollback) sans perte de données
Le volume `pgdata` stockant les données PostgreSQL est complètement découplé des conteneurs applicatifs. Pour revenir à une version antérieure sans impacter les commandes ni les utilisateurs :

1. Identifier le tag SHA du commit précédent sur GitHub Packages :
   `ghcr.io/brumev2/brume_back:<commit-sha>`
2. Modifier temporairement l'image dans `/opt/filrouge/compose.yml`.
3. Relancer le conteneur :
   ```bash
   sudo docker compose pull back
   sudo docker compose up -d --no-deps back
   ```
Les tables et données persistées dans PostgreSQL restent intactes.
