# Authentification Google — US-045, US-046, ADD-087

## Périmètre livré

Google est le seul fournisseur de connexion et d'inscription. Aucun mot de passe client, JWT d'accès applicatif ou refresh token Google n'est stocké. Une première connexion crée un client ; les suivantes retrouvent ce client via le `sub` Google, jamais via l'e-mail seul.

L'API propose :

| Méthode | Route | Résultat |
|---|---|---|
| GET | `/api/auth/google` | Cookie temporaire, redirection vers Google |
| GET | `/api/auth/google/callback` | Vérification, création/récupération du client, cookie de session, redirection frontend |
| GET | `/api/users/me` | Profil du client identifié par la session |
| POST | `/api/auth/logout` | Révocation de la session courante, suppression du cookie, 204 |

Les anciennes routes proposées `/auth/register`, `/auth/login`, `/auth/refresh` sont retirées du contrat. Le changement de contrat est incompatible : version 1.0.0. Les autres domaines du contrat restent une cible et ne sont pas implémentés par cette branche (commandes, panier, adresses, administration, modification du profil).

## Configuration Google et lancement local

1. Copier `.env.example` en `.env`.
2. Dans Google Cloud, configurer l'écran de consentement et un client OAuth de type **Application Web**. En mode test, autoriser les comptes de test nécessaires.
3. Déclarer exactement `http://localhost:3000/api/auth/google/callback` comme URI de redirection autorisée pour le développement.
4. Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env`, uniquement côté API. Ne pas transmettre le secret au frontend ou au dépôt.
5. Adapter `CORS_ORIGIN` et `AUTH_SUCCESS_URL` au frontend. Les origines sont explicites, sans slash final ; l'URL de succès doit appartenir à une origine autorisée.
6. Lancer `docker compose up -d --build`, puis `docker compose exec api npm run migration:run`.
7. Ouvrir `http://localhost:3000/api/auth/google` dans le navigateur.

Sans identifiants Google, l'API peut démarrer en développement ; l'entrée Google répond 503. Le mode production refuse de démarrer sans configuration Google, URL HTTPS et cookies Secure.

Les URI sont configurées côté serveur : aucun paramètre utilisateur ne choisit la redirection finale. Aucun jeton n'est placé dans cette redirection. Google est sollicité seulement avec `openid email profile`, sans accès hors ligne.

## Intégration frontend

Le bouton Google effectue une **navigation du navigateur** vers `/api/auth/google`, par exemple avec un lien. Après le retour vers `AUTH_SUCCESS_URL`, appeler `/api/users/me` avec `credentials: 'include'`.

```ts
const response = await fetch(`${apiUrl}/users/me`, {
  credentials: 'include',
});
```

Pour déconnecter :

```ts
const response = await fetch(`${apiUrl}/auth/logout`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'X-CSRF-Protection': '1' },
});
if (response.status === 204) {
  // Effacer l'état connecté côté interface.
}
```

Le navigateur fournit `Origin`. Toute mutation exige une origine autorisée et le header `X-CSRF-Protection: 1`, y compris la déconnexion. Ne confirmer la déconnexion serveur qu'après réception d'un 204. En cas d'échec réseau ou de réponse 503, le résultat serveur ne peut pas être confirmé par l'interface ; réessayer est sans danger.

Une session absente, invalide, expirée ou révoquée donne `401 UNAUTHENTICATED` sur les routes privées. Le frontend propose alors une nouvelle connexion Google. Il n'existe pas de renouvellement silencieux dans ce périmètre.

## Comptes et données

- Tables métier : `utilisateurs` et `sessions`. Les propriétés de l'API restent en camelCase ; les colonnes SQL suivent le schéma français (`prenom`, `nom`, `statut`, `email_verifie_at`, `utilisateur_id`).
- Contraintes uniques en base : `google_sub`, e-mail normalisé en minuscules, empreinte du jeton de session.
- Une insertion avec `ON CONFLICT DO NOTHING`, suivie d'une recherche par `google_sub`, empêche les doublons lors des créations concurrentes.
- Une adresse déjà associée à un autre `sub` est refusée avec le même message générique que les autres échecs d'authentification. Aucun rapprochement automatique d'identités.
- L'e-mail Google doit être valide et `email_verified` doit être vrai. `email_verifie_at` est obligatoire pour les comptes créés par ce parcours.
- Prénom et nom sont facultatifs : Google ne garantit pas leur présence. Le téléphone reste nul à la création. Ces informations pourront être complétées dans la future story de profil.
- Rôle initial `CUSTOMER`. État initial `ACTIVE`. Un compte `BLOCKED` ne peut ni se connecter ni réutiliser une session antérieure.
- `/users/me` déduit le propriétaire de la session ; un ID utilisateur envoyé par le client est ignoré. Pour chaque futur domaine, filtrer aussi les ressources par cet utilisateur. Les routes d'administration devront ajouter une autorisation de rôle ; elles ne sont pas encore présentes.
- La table `adresses` et ses opérations restent hors de ces trois tâches.

## Sessions et protection du parcours

Le cookie `brume_session` contient 32 octets aléatoires encodés en base64url. Seule son empreinte SHA-256 est stockée en base. Il est `HttpOnly; SameSite=Lax; Path=/api`, sans attribut Domain ; `Secure` est obligatoire hors développement local. L'expiration est absolue : 24 heures par défaut, configurable par `AUTH_SESSION_TTL_SECONDS` (60 secondes à 30 jours).

Chaque requête privée relit la session et l'état du compte en base. Une révocation est donc effective dès la requête suivante, sans attendre l'expiration d'un JWT. Plusieurs appareils disposent de sessions indépendantes. Le logout révoque uniquement le jeton présenté. Il est idempotent si le jeton est absent ou déjà révoqué ; si la mise à jour en base échoue, l'API retourne 503 et ne supprime pas le cookie.

Le cookie `brume_oauth` est temporaire (10 minutes), `HttpOnly; SameSite=Lax; Path=/api/auth`. Une transaction en base contient les empreintes du state et du secret du navigateur, le nonce et le vérificateur PKCE. Le callback consomme cette transaction avec un `DELETE ... RETURNING` atomique avant l'échange Google. Un callback rejoué ou traité en concurrence ne peut pas créer deux sessions.

La bibliothèque officielle `google-auth-library` vérifie la signature, l'émetteur et l'audience du jeton Google. L'API contrôle aussi son expiration stricte, son instant d'émission, le nonce, l'identifiant du sujet et l'e-mail vérifié. Les appels Google ont un délai maximal de cinq secondes par requête HTTP.

La limitation est partagée en PostgreSQL : `AUTH_RATE_LIMIT=20` requêtes par `AUTH_RATE_WINDOW_SECONDS=60` secondes et par IP, cumulant démarrage et callback. Un dépassement donne `429 RATE_LIMITED` avec `Retry-After`. `X-Forwarded-For` n'est pas considéré comme fiable par défaut (`AUTH_TRUST_PROXY_HOPS=0`). Derrière un reverse proxy maîtrisé, définir le nombre exact de sauts de confiance (par exemple `1`) et interdire l'accès direct à l'API ainsi que les chemins plus courts ; une mauvaise configuration permettrait de falsifier l'IP. Sans ce réglage, les requêtes du proxy partagent le même compteur.

Les réponses d'authentification ne sont pas mises en cache. Les erreurs ne contiennent ni détail SQL, ni code OAuth, ni jeton, ni query string. Les données d'authentification et les erreurs brutes des fournisseurs ne sont pas journalisées par le code.

## Exploitation et préproduction

- Utiliser des origines frontend/API du **même site** (par exemple `shop.example.com` et `api.example.com`) avec HTTPS ; les cookies SameSite=Lax ne prennent pas en charge un frontend hébergé sur un site tiers.
- Configurer un client OAuth adapté à la préproduction et son URI de retour exacte ; définir `NODE_ENV=production`, `AUTH_COOKIE_SECURE=true`, les URL HTTPS et les origines autorisées.
- Fournir les secrets via l'environnement du service. Configurer `AUTH_TRUST_PROXY_HOPS` selon la topologie réseau réelle.
- Après compilation, appliquer la migration avec `npm run migration:run:prod`, puis démarrer le service. `synchronize` reste désactivé.
- Les logs du reverse proxy doivent masquer la query string du callback OAuth et les headers Cookie/Set-Cookie ; le proxy ne doit pas journaliser les corps ou les secrets.
- Prévoir une purge périodique des données temporaires, par exemple chaque minute pour les transactions OAuth expirées et chaque jour pour les compteurs et sessions inutilisables :

```sql
DELETE FROM oauth_transactions WHERE expires_at <= now();
DELETE FROM auth_rate_limits WHERE expires_at <= now();
DELETE FROM sessions WHERE expires_at <= now() OR revoked_at IS NOT NULL;
```

Les lignes expirées restent inutilisables même avant la purge. La révocation ne déconnecte pas le compte Google du navigateur et ne révoque pas les autres applications Google.

## Validation reproductible

```bash
npm ci
npm run build
npm run lint
npm test -- --runInBand
```

Jest et ts-jest sont configurés en ESM, avec `--experimental-vm-modules`, pour charger les dépendances du dépôt sous Node 22. Les tests unitaires vérifient réellement des signatures RSA ; seules les requêtes réseau vers Google sont simulées.

Les tests HTTP utilisent un **vrai PostgreSQL**, les migrations et les modules de production, avec un fournisseur Google simulé. Créer une base exclusivement réservée aux tests, dont le nom finit par `_test`. Les tables d'authentification de cette base sont vidées entre les tests.

```bash
# Exemple : PostgreSQL local déjà disponible, base de test créée séparément
TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=5432 \
TEST_DB_USER=brume TEST_DB_PASSWORD=change-me TEST_DB_NAME=brume_auth_test \
npm run test:e2e -- --runInBand
```

Couverture : création et reconnexion, demandes concurrentes, rejeu du callback, collision d'e-mail, compte bloqué, profils isolés, transaction expirée ou invalide, indisponibilité Google, sessions expirées, logout, persistance en échec, autres appareils, CSRF, CORS et limitation des tentatives.

La connexion réelle à Google, la revue de code, le déploiement en préproduction et la validation frontend/API de bout en bout restent nécessaires avant de déclarer les stories produit terminées.
