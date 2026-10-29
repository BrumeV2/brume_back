# Adresses clients — US-048

Les adresses sont saisies par le client après connexion Google. Le SSO ne fournit pas l'adresse postale. Les données sont stockées dans `adresses`, liée à `utilisateurs` par `utilisateur_id` avec suppression en cascade.

## Routes

Toutes les routes exigent une session valide. Le propriétaire vient de cette session ; l'API refuse un `userId` fourni dans le corps.

| Méthode | Route | Réponse |
|---|---|---|
| GET | `/api/users/me/addresses` | 200, liste des seules adresses du client, adresse par défaut en premier |
| POST | `/api/users/me/addresses` | 201, adresse créée |
| PATCH | `/api/users/me/addresses/{id}` | 200, adresse modifiée partiellement |
| DELETE | `/api/users/me/addresses/{id}` | 204, adresse supprimée |

Les mutations exigent aussi une `Origin` configurée dans `CORS_ORIGIN` et le header `X-CSRF-Protection: 1`. Dans le navigateur, utiliser `credentials: 'include'`. Swagger est disponible sur http://localhost:3000/api/docs ; pour tester ses mutations depuis cette origine, autoriser également `http://localhost:3000` dans `CORS_ORIGIN`, puis recréer le conteneur API.

## Créer une adresse

Exemple de corps pour `POST /api/users/me/addresses` :

```json
{
  "firstName": "Camille",
  "lastName": "Martin",
  "line1": "12 rue des Lilas",
  "line2": "Appartement 2",
  "postalCode": "69003",
  "city": "Lyon",
  "country": "FR",
  "phone": "0612345678",
  "label": "Maison",
  "isDefault": true
}
```

Champs obligatoires : `firstName`, `lastName`, `line1`, `postalCode`, `city`, `country`, `phone`. Les chaînes sont nettoyées des espaces en début et fin ; les champs obligatoires ne peuvent pas être vides. Les propriétés inconnues sont refusées.

| Champ | Règle |
|---|---|
| firstName, lastName, city | 1 à 100 caractères |
| line1 | 1 à 200 caractères |
| line2 | Facultatif, au plus 200 caractères, accepte null |
| label | Facultatif, au plus 50 caractères, accepte null |
| postalCode | Cinq chiffres, code de France métropolitaine continentale ; Corse et outre-mer exclus |
| country | FR, conformément au contrat de livraison D-003 |
| phone | Téléphone français de dix chiffres, commençant par 01 à 09 |
| isDefault | Booléen facultatif, false à la création si absent |

La réponse contient l'adresse, son UUID, `createdAt` et `updatedAt`. Elle n'expose ni le propriétaire SQL ni sa relation utilisateur.

## Modifier et choisir l'adresse par défaut

Un PATCH accepte au moins un champ. Les champs absents sont conservés. Seuls `label` et `line2` acceptent explicitement null.

```json
{ "label": "Travail", "isDefault": true }
```

`isDefault: true` remplace l'ancien défaut du même client dans une transaction. Un verrou sur l'utilisateur sérialise les opérations concurrentes et un index unique partiel garantit en base qu'un client ne possède jamais plus d'une adresse par défaut.

La première adresse ne devient pas automatiquement l'adresse par défaut. Mettre le défaut à false ou supprimer l'adresse par défaut laisse le client sans défaut ; aucune autre adresse n'est choisie automatiquement.

## Erreurs

| HTTP | Code | Cas |
|---|---|---|
| 400 | VALIDATION_ERROR | Champs absents, vides, trop longs, format invalide, null interdit, propriété inconnue, PATCH vide ou UUID invalide |
| 401 | UNAUTHENTICATED | Session absente, expirée, révoquée ou compte bloqué |
| 403 | FORBIDDEN | Origine ou protection CSRF absente/invalide |
| 404 | NOT_FOUND | Adresse absente ou appartenant à un autre client |
| 422 | SHIPPING_ZONE_NOT_SERVED | Pays ou code postal hors de la zone desservie |
| 503 | AUTH_UNAVAILABLE | Stockage indisponible, sans détail SQL ni donnée personnelle |

Pour une erreur de validation du corps, `details` identifie les champs et les contraintes sans reproduire les valeurs saisies :

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Certains champs sont invalides.",
  "details": [{ "field": "phone", "constraints": ["matches"] }],
  "path": "/api/users/me/addresses",
  "timestamp": "2026-10-29T10:00:00.000Z"
}
```

## Migration et validation

```bash
docker compose exec api npm run migration:run
```

La migration `CreateAddresses1793261709905` crée uniquement la table, ses contraintes et ses index. Elle ne modifie pas les comptes existants. Son retour arrière supprime la table et ses données ; à réserver aux bases de test ou à une procédure de restauration prévue.

Les tests HTTP existants sont complétés par la gestion complète des adresses, l'isolation entre deux clients, les données invalides, les zones refusées, les modifications partielles, les requêtes concurrentes sur le défaut, la contrainte d'unicité PostgreSQL et la protection CSRF. Voir [AUTH.md](AUTH.md#validation-reproductible) pour lancer les tests dans une base dédiée finissant par `_test`.

Le frontend et le parcours checkout doivent encore intégrer ces routes. Les commandes devront conserver une copie de l'adresse de livraison afin qu'une modification ultérieure du carnet ne modifie pas une commande passée.
