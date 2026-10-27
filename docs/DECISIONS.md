# Journal des décisions — Cadrage produit (T-001, T-003)

> **Statuts** : 🟡 Proposé (à valider) · 🟢 Validé · 🔴 Ouvert (pas de proposition, décision à prendre)
> **Règle** : toute décision qui change passe par une MR qui modifie ce fichier (nouvelle ligne dans l'historique en bas). Le code applique ce qui est 🟢 ; ce qui est 🟡 est implémenté de façon paramétrable.
> ⚖️ = à faire confirmer par un expert-comptable / juriste avant mise en production.

## Récapitulatif

| ID | Sujet | Règle (résumé) | Statut | Responsable | Stories |
|---|---|---|---|---|---|
| D-001 | Périmètre vendable | Thé, café, CBD (THC ≤ 0,3 %), box, accessoires | 🟡 ⚖️ | PO + juriste | US-001, 002, 006, 076 |
| D-002 | Âge minimum CBD | 18 ans, déclaratif au checkout si le panier contient du CBD | 🟡 ⚖️ | PO + juriste | US-025, 045 |
| D-003 | Zones servies | France métropolitaine continentale uniquement | 🟡 | PO | US-026, 027, 052 |
| D-004 | Devise | EUR uniquement, montants en centimes (int) | 🟢 | Tech lead | toutes |
| D-005 | Prix affichés | TTC, prix stocké TTC par variante (SKU), taux de TVA sur le produit | 🟡 | PO + comptable | US-001, 002, 024, 080 |
| D-006 | Taux de TVA | 5,5 % thé/café · 20 % CBD et accessoires · box ventilée par composant | 🟡 ⚖️ | Comptable | US-024, 028, 080 |
| D-007 | Arrondis | TVA calculée par taux sur le total, arrondi au centime half-up | 🟡 | Tech lead + comptable | US-024, 028, 029 |
| D-008 | Tarifs livraison | Point relais 3,90 € · domicile 5,90 € · offert dès 49 € | 🟡 | PO | US-027, 052 |
| D-009 | TVA sur la livraison | Ventilée au prorata du HT de chaque taux | 🟡 ⚖️ | Comptable | US-028 |
| D-010 | Politique de retour | Rétractation 14 j, sauf produits descellés ; retour à la charge du client | 🟡 ⚖️ | PO + juriste | US-036, 037, 071 |
| D-011 | Réservation du stock | Réservé à la création de commande, 30 min, libéré si non payé | 🟡 | Tech lead | US-004, 021, 029, 033 |
| D-012 | Statuts de commande | 7 statuts, transitions pilotées par le webhook de paiement | 🟡 | Tech lead + PO | US-029 à 035, 083 |
| D-013 | Compte obligatoire | Compte obligatoire pour commander (pas d'achat invité au MVP) | 🟡 | PO | US-025, 045, 046, 050 |
| D-014 | Codes promo | Réduction appliquée avant TVA, ventilée par taux au prorata | 🟡 ⚖️ | PO + comptable | US-064 |
| D-015 | Prestataire de paiement | Stripe Checkout (page hébergée) | 🟢 | Tech lead | US-033 à 035 |
| D-016 | Variantes produit | Produit + variantes (SKU), chacune avec son prix et son stock | 🟢 | PO + tech lead | US-001, 002, 004, 021, 080 |
| D-017 | Panier visiteur | Panier en localStorage côté front, fusionné au panier du compte à la connexion | 🟢 | Tech lead + front | US-021 à 024, 046 |
| D-018 | Contrat d'API | OpenAPI écrit d'abord (`docs/contract/openapi.yaml`), le code doit s'y conformer | 🟢 | Tech lead | toutes |
| D-019 | Jetons d'auth | JWT d'accès 15 min (header Bearer) + refresh token en cookie httpOnly | 🟡 | Tech lead | US-045, 046 |

---

## D-001 — Périmètre vendable 🟡 ⚖️

- **Vendu** : thés et infusions, cafés (grains / moulu), produits CBD, TEA-BOX, Calendrier de l'Avent, accessoires.
- **CBD** : uniquement des produits issus de variétés de chanvre autorisées, **THC ≤ 0,3 %**, avec certificat d'analyse par lot. Aucune allégation thérapeutique dans les fiches produit.
- ⚖️ **À vérifier par un juriste avant la mise en ligne** : les produits CBD **à ingérer** (huiles, infusions au CBD, comestibles) relèvent du règlement européen *Novel Food*. Il faut confirmer catégorie par catégorie ce qui peut être vendu.
- Impact technique : `Product.type` = `TEA | COFFEE | CBD | BOX | ADVENT_CALENDAR | ACCESSORY` ; un booléen `ageRestricted` sur le produit (ou dérivé de `type = CBD`).

## D-002 — Âge minimum pour le CBD 🟡 ⚖️

- Le panier contient au moins un produit `ageRestricted` → case « Je certifie avoir 18 ans ou plus » obligatoire au checkout, horodatée sur la commande.
- Pas de vérification d'identité au MVP.

## D-003 — Zones servies 🟡

- **MVP : France métropolitaine continentale** (code postal hors 20xxx).
- Exclus pour l'instant : Corse, DROM-COM (fiscalité différente, octroi de mer), étranger (législation CBD variable).
- Impact technique : validation du pays (`FR`) et du code postal dans le DTO d'adresse.

## D-004 — Devise 🟢

- EUR uniquement. Tous les montants sont des **entiers en centimes** (`priceCents`, `totalCents`…).

## D-005 — Prix affichés 🟡

- Vente aux particuliers (B2C) → prix affichés **TTC**.
- La **variante** (SKU, voir D-016) stocke `priceCents` (**TTC**) ; le **produit** stocke `vatRateBps` (taux en points de base : 550 = 5,5 %, 2000 = 20 %), commun à toutes ses variantes.
- Le HT et la TVA sont **dérivés** et ne sont jamais saisis.

## D-006 — Taux de TVA 🟡 ⚖️

| Catégorie | Taux proposé |
|---|---|
| Thé, infusions, café (denrées alimentaires) | 5,5 % |
| CBD (fleurs, huiles, cosmétiques) | 20 % |
| Accessoires (théières, tasses…) | 20 % |
| TEA-BOX / Calendrier (contenu mixte) | ventilé par composant au prorata de leur valeur |

- ⚖️ Le taux de chaque catégorie CBD est à faire confirmer par l'expert-comptable.
- Pour une box à contenu mixte, le produit garde **un** prix TTC. La répartition de sa TVA par taux se calcule à partir de la valeur de ses composants (`ProductComponent`).

## D-007 — Arrondis 🟡

1. Total TTC d'une ligne = `prix unitaire TTC × quantité` (valeurs exactes, en centimes).
2. Les lignes sont regroupées **par taux de TVA**.
3. Pour chaque taux : `TVA = round(TTC_du_taux × taux / (1 + taux))`, puis `HT = TTC_du_taux − TVA`.
4. Arrondi **au centime, demi supérieur (half-up)**.
5. Le total TTC payé est **exactement** la somme des lignes TTC + livraison TTC − remises TTC. On calcule la TVA à partir des montants TTC, jamais l'inverse, pour éviter les écarts d'un centime.

> Les montants ventilés (livraison, remises) suivent la même règle : chaque part est arrondie, et la **dernière part reçoit le reste**, pour que la somme retombe exactement sur le total.

## D-008 — Tarifs de livraison 🟡

| Mode | Prix TTC | Délai indicatif |
|---|---|---|
| Point relais | 3,90 € | 3 à 5 jours ouvrés |
| Domicile (suivi) | 5,90 € | 2 à 3 jours ouvrés |
| **Livraison offerte** | dès **49 € TTC** d'articles (après remise) | — |

- Montants à valider par le PO (coûts réels des transporteurs à obtenir). Ils sont stockés en base (`ShippingMethod`), pas écrits en dur dans le code.
- Les transporteurs (Colissimo, Mondial Relay…) restent 🔴 à choisir.

## D-009 — TVA sur la livraison 🟡 ⚖️

- Les frais de port sont un frais accessoire : ils suivent le taux des articles livrés.
- Si la commande contient plusieurs taux, les frais de port sont **ventilés au prorata du montant HT** des articles de chaque taux (voir commande témoin).

## D-010 — Politique de retour 🟡 ⚖️

- **Droit de rétractation de 14 jours** à compter de la réception (art. L221-18 du Code de la consommation).
- **Exclus** : produits **descellés** après livraison qui ne peuvent pas être renvoyés pour des raisons d'hygiène ou de santé (thé, café, CBD ouverts), ainsi que les **mélanges TeaOMatic** fabriqués à la demande (art. L221-28).
- Frais de retour à la charge du client (à indiquer dans les CGV).
- Remboursement sous 14 jours après la rétractation, éventuellement à réception du retour, sur le moyen de paiement d'origine.
- Abonnements : le délai de 14 jours court à partir de la réception de la première box.
- Produit endommagé ou erroné : réclamation (US-071), remboursement total ou partiel par un admin (US-036, US-037), retour à nos frais.

## D-011 — Réservation du stock 🟡

- **Le panier ne réserve pas** : le stock est seulement *vérifié* à l'ajout et à la modification (US-021, US-022).
- **À la création de la commande** (statut `PENDING_PAYMENT`) : le stock est **décrémenté dans une transaction**, ce qui le réserve.
- **Durée : 30 minutes** (durée minimale d'expiration d'une session Stripe Checkout). Après ce délai sans paiement, la commande passe `CANCELLED` et le stock est **réintégré** (tâche planifiée + écoute de l'événement d'expiration du PSP).
- Si le stock est insuffisant à la création de la commande → erreur 409, et le panier indique les lignes en cause.
- Chaque mouvement est journalisé dans `StockMovement` (`RESERVATION`, `RELEASE`, `SALE`, `RETURN`, `ADJUSTMENT`).

## D-012 — Statuts de commande et transitions 🟡

```
PENDING_PAYMENT ──paiement réussi──▶ PAID ──admin──▶ PREPARING ──admin/expédition──▶ SHIPPED ──transporteur/admin──▶ DELIVERED
      │                               │                  │
      │ échec/expiration 30 min       │ admin            │ admin
      ▼                               ▼                  ▼
  CANCELLED                       CANCELLED          CANCELLED
                                (+ remboursement)   (+ remboursement)
```

| De | Vers | Déclencheur | Effets |
|---|---|---|---|
| — | `PENDING_PAYMENT` | Client confirme la commande (US-029) | Prix gelés dans `OrderItem`, stock réservé, session de paiement créée |
| `PENDING_PAYMENT` | `PENDING_PAYMENT` | **Webhook** paiement échoué (US-034) | Commande inchangée, le client peut réessayer tant que la réservation n'a pas expiré |
| `PENDING_PAYMENT` | `PAID` | **Webhook** paiement réussi (US-035) | Panier vidé, email de confirmation (US-030), mouvement `SALE` |
| `PENDING_PAYMENT` | `CANCELLED` | Expiration 30 min / annulation client | Stock réintégré (`RELEASE`) |
| `PAID` | `PREPARING` | Admin (US-083) | — |
| `PREPARING` | `SHIPPED` | Admin saisit le n° de suivi (US-053, 054) | Email d'expédition |
| `SHIPPED` | `DELIVERED` | Admin ou transporteur | — |
| `PAID` / `PREPARING` | `CANCELLED` | Admin | Remboursement total + stock réintégré (`RETURN`) |

- **Seul le webhook** (signature vérifiée) fait passer une commande à `PAID`. Le retour du navigateur sur la page de succès ne sert qu'à l'affichage.
- Le webhook est **idempotent** : un même événement reçu deux fois n'a aucun effet la seconde fois.
- Les remboursements (US-036, US-037) sont suivis dans `Refund` / `Payment`. Le statut de la commande ne change pas sur un remboursement partiel.
- Toute transition non listée dans le tableau → erreur 409.

## D-013 — Compte obligatoire 🟡

**Proposition : un compte est obligatoire pour commander au MVP.**

| | Compte obligatoire | Achat invité |
|---|---|---|
| Conversion | − (étape d'inscription) | + |
| Historique / suivi (US-050, 031) | natif | lien magique par email à développer |
| Abonnements, fidélité, avis « acheteur vérifié » | natif | impossible ou complexe |
| Déclaration d'âge CBD | rattachée au compte | à refaire à chaque commande |
| Effort MVP | auth déjà prévue (US-045, 046) | modèle et parcours en plus |

- Pour limiter l'impact sur la conversion : inscription **dans le tunnel**, en quelques champs seulement (email, mot de passe, nom).
- L'achat invité reste une option pour la V1, décision 🔴.

## D-014 — Codes promo 🟡 ⚖️

- La remise est calculée côté serveur sur le sous-total **articles** TTC (la livraison n'est pas concernée, sauf code « livraison offerte »).
- Elle **réduit la base taxable** : on la ventile par taux au prorata du HT de chaque taux, comme la livraison (D-009).
- Le seuil de livraison offerte (D-008) s'apprécie **après remise**.
- Un seul code par commande au MVP.

## D-015 — Prestataire de paiement 🟢

- **Stripe Checkout** : l'API crée une *Checkout Session* et renvoie son URL ; le client paie sur la page hébergée par Stripe puis revient sur le front.
- Cartes, Apple Pay / Google Pay, 3-D Secure, remboursements partiels gérés par Stripe ; PCI simplifié (aucune donnée carte ne transite par Brume).
- La validation du paiement passe **uniquement** par le webhook (`checkout.session.completed`, `checkout.session.expired`, `charge.refunded`…), voir D-012.

## D-016 — Variantes produit (SKU) 🟢

- Un **produit** (fiche : nom, description, catégorie, type, taux de TVA) a **une ou plusieurs variantes**.
- Une **variante** = un SKU vendable : libellé (« 100 g », « Grains 250 g »), code SKU unique, prix TTC, poids, stock.
- Un produit sans déclinaison a **une seule** variante (pas de cas particulier dans le code).
- Le panier, la commande et le stock référencent toujours la **variante**.

## D-017 — Panier d'un visiteur non connecté 🟢

- Les routes `/cart` de l'API exigent d'être connecté.
- Le visiteur a un panier **en localStorage** côté front (liste `variantId` + quantité, sans prix).
- À la connexion / l'inscription, le front appelle `POST /cart/merge` : l'API ajoute ces lignes au panier du compte (quantités additionnées, plafonnées au stock), puis le front vide son localStorage.
- Les prix affichés pour le panier invité viennent de l'API catalogue, jamais du localStorage.

## D-018 — Contrat d'API écrit d'abord 🟢

- Le contrat de référence est `docs/contract/openapi.yaml`, partagé avec `brume-front`.
- Le front développe contre un **mock** généré depuis ce fichier (Prism) et le jeu de données `docs/contract/seed.json`.
- Toute évolution de l'API commence par une MR qui modifie le contrat. Le Swagger généré par le code (`/api/docs-json`) doit rester conforme.

## D-019 — Jetons d'authentification 🟡

- **Access token** JWT, durée 15 min, envoyé dans le header `Authorization: Bearer`.
- **Refresh token** opaque, durée 30 jours, en cookie `httpOnly; Secure; SameSite=Strict`, stocké haché en base, renouvelé à chaque utilisation (rotation). `POST /auth/refresh`, `POST /auth/logout`.

---

## Commande témoin (à valider par le métier)

Panier :

| Article | Taux | PU TTC | Qté | Total TTC |
|---|---|---|---|---|
| Thé Earl Grey 100 g | 5,5 % | 12,90 € | 2 | 25,80 € |
| Fleurs CBD 3 g | 20 % | 14,90 € | 1 | 14,90 € |
| **Sous-total articles** | | | | **40,70 €** |
| Livraison domicile (< 49 €) | ventilée | | | 5,90 € |
| **Total payé** | | | | **46,60 €** |

**1. Ventilation de la livraison au prorata du HT des articles (D-009)**

| Taux | TTC articles | HT articles | Part du HT | Livraison ventilée |
|---|---|---|---|---|
| 5,5 % | 25,80 € | 24,455 € | 66,33 % | round(5,90 × 66,33 %) = **3,91 €** |
| 20 % | 14,90 € | 12,417 € | 33,67 % | reste = 5,90 − 3,91 = **1,99 €** |

**2. TVA par taux (D-007)**

| Taux | Base TTC (articles + livraison) | TVA = round(TTC × t / (1+t)) | HT |
|---|---|---|---|
| 5,5 % | 25,80 + 3,91 = 29,71 € | 1,549 → **1,55 €** | 28,16 € |
| 20 % | 14,90 + 1,99 = 16,89 € | 2,815 → **2,82 €** | 14,07 € |
| **Total** | **46,60 €** | **4,37 €** | **42,23 €** |

Contrôle : 42,23 + 4,37 = 46,60 € ✔

> Cet exemple servira de **test automatisé** du service de calcul (cas nominal). D'autres cas seront ajoutés au même test : livraison offerte au-delà de 49 €, code promo, box à contenu mixte.

---

## Décisions encore ouvertes 🔴

| # | Question | Qui tranche | Bloque |
|---|---|---|---|
| O-1 | Quels produits CBD ingérables peut-on vendre (Novel Food) ? | Juriste | Catalogue CBD |
| ~~O-2~~ | ~~Stripe Checkout ou Payment Element ?~~ → tranché : D-015 | — | — |
| O-3 | Quels transporteurs, et suivi automatique ou saisi à la main ? | PO | US-052, 053 |
| O-4 | Achat invité en V1 ? | PO | — |
| O-5 | Ouverture à la Corse, aux DROM, à l'UE ? | PO + comptable | — |
| O-6 | Facture PDF générée par l'API ou par le PSP ? Numérotation des factures ? | Comptable | US-030, 031 |
| O-7 | Cartes cadeaux : TVA à l'émission ou à l'utilisation (bon à usage unique ou multiple) ? | Comptable | US-065, 066 |
| O-8 | Seuil de livraison offerte et tarifs définitifs | PO | US-027 |

---

## Historique

| Date | Version | Changement | Auteur |
|---|---|---|---|
| 2026-10-09 | 0.1 | Création : propositions D-001 à D-015, commande témoin, décisions ouvertes | Équipe back |
| 2026-10-09 | 0.2 | T-003 : D-015 tranché (Stripe Checkout), ajout D-016 (variantes), D-017 (panier visiteur), D-018 (contrat OpenAPI), D-019 (jetons) | Équipe back |
