import { Test, TestingModule } from '@nestjs/testing';
import {
  CartPricingService,
  DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
  DEFAULT_VAT_RATE_BPS,
  STANDARD_VAT_RATE_BPS,
} from './cart-pricing.service';

describe('CartPricingService (US-024)', () => {
  let service: CartPricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CartPricingService],
    }).compile();

    service = module.get<CartPricingService>(CartPricingService);
  });

  describe('Règles d arrondi demi-supérieur (D-007)', () => {
    it('arrondit au centime le plus proche selon la règle half-up', () => {
      expect(service.roundHalfUp(2.5)).toBe(3);
      expect(service.roundHalfUp(2.49)).toBe(2);
      expect(service.roundHalfUp(2.51)).toBe(3);
      expect(service.roundHalfUp(154.89)).toBe(155);
      expect(service.roundHalfUp(281.5)).toBe(282);
      expect(service.roundHalfUp(0)).toBe(0);
    });

    it('calcule le total de ligne avec des entiers strictement positifs', () => {
      expect(service.calculateLineTotal(1290, 2)).toBe(2580);
      expect(service.calculateLineTotal(490, 3)).toBe(1470);
      expect(service.calculateLineTotal(1000, 0)).toBe(0);

      expect(() => service.calculateLineTotal(-100, 1)).toThrow();
      expect(() => service.calculateLineTotal(100, -1)).toThrow();
    });
  });

  describe('Validation n°1 : Quantités multiples et remises (D-014)', () => {
    it('calcule une remise fixe plafonnée au montant du sous-total', () => {
      // Remise fixe de 10,00 € (1000 centimes) sur sous-total de 40,70 €
      const discount = service.calculateDiscount(4070, {
        type: 'FIXED',
        amountCents: 1000,
      });
      expect(discount).toBe(1000);

      // Remise fixe supérieure au sous-total : plafonnée à 25,00 €
      const capped = service.calculateDiscount(2500, {
        type: 'FIXED',
        amountCents: 5000,
      });
      expect(capped).toBe(2500);
    });

    it('calcule une remise en pourcentage avec arrondi demi-supérieur', () => {
      // 10 % (1000 bps) sur 25,85 € (2585 centimes) : 258.5 -> arrondi à 259 centimes
      const discount = service.calculateDiscount(2585, {
        type: 'PERCENTAGE',
        rateBps: 1000,
      });
      expect(discount).toBe(259);
    });

    it('calcule un panier avec quantités multiples et remise selon les règles retenues', () => {
      const lines = [
        { unitPriceCents: 1290, quantity: 3 }, // 3 x 12.90 = 38.70 €
        { unitPriceCents: 1500, quantity: 2 }, // 2 x 15.00 = 30.00 €
      ];

      const result = service.calculateCartTotals(lines, {
        discount: { type: 'FIXED', amountCents: 1000 }, // 10.00 € de remise
      });

      expect(result.itemsCount).toBe(5);
      expect(result.itemsTotalCents).toBe(6870); // 68.70 €
      expect(result.discountCents).toBe(1000); // 10.00 €
      expect(result.itemsTotalAfterDiscountCents).toBe(5870); // 58.70 €
      expect(result.totalCents).toBe(5870);
    });
  });

  describe('Validation n°2 : Arrondis monétaires et montant de livraison encore inconnu', () => {
    it('laisse shippingCents à null lorsque le mode de livraison est inconnu au panier', () => {
      const lines = [
        { unitPriceCents: 1290, quantity: 2 }, // 25.80 €
        { unitPriceCents: 1490, quantity: 1 }, // 14.90 €
      ];

      // Pas de shippingMethod fourni
      const result = service.calculateCartTotals(lines);

      expect(result.itemsCount).toBe(3);
      expect(result.itemsTotalCents).toBe(4070);
      expect(result.shippingCents).toBeNull();
      expect(result.totalCents).toBe(4070); // Seul le total connu est affiché
      // Seuil par défaut à 49,00 € (4900 centimes) -> restant 4900 - 4070 = 830 centimes (8.30 €)
      expect(result.freeShippingRemainingCents).toBe(830);
    });

    it('applique les frais de port quand ils sont connus et sous-total inférieur au seuil', () => {
      const lines = [{ unitPriceCents: 1290, quantity: 2 }]; // 25.80 €

      const result = service.calculateCartTotals(lines, {
        shippingMethod: {
          code: 'HOME',
          name: 'Livraison à domicile',
          priceCents: 590,
          freeFromCents: 4900,
        },
      });

      expect(result.itemsTotalCents).toBe(2580);
      expect(result.shippingCents).toBe(590);
      expect(result.totalCents).toBe(2580 + 590);
      expect(result.freeShippingRemainingCents).toBe(4900 - 2580);
    });

    it('offre la livraison dès que le sous-total après remise atteint le seuil (D-008, D-014)', () => {
      // 50.00 € d'articles -> seuil de 49.00 € dépassé
      const lines = [{ unitPriceCents: 2500, quantity: 2 }];

      const result = service.calculateCartTotals(lines, {
        shippingMethod: {
          code: 'HOME',
          priceCents: 590,
          freeFromCents: 4900,
        },
      });

      expect(result.itemsTotalCents).toBe(5000);
      expect(result.shippingCents).toBe(0);
      expect(result.totalCents).toBe(5000);
      expect(result.freeShippingRemainingCents).toBe(0);
    });

    it('n offre plus la livraison si la remise fait repasser le panier sous le seuil', () => {
      // 52.00 € d'articles avec 5.00 € de remise -> 47.00 € (< 49.00 €)
      const lines = [{ unitPriceCents: 5200, quantity: 1 }];

      const result = service.calculateCartTotals(lines, {
        discount: { type: 'FIXED', amountCents: 500 },
        shippingMethod: {
          code: 'HOME',
          priceCents: 590,
          freeFromCents: 4900,
        },
      });

      expect(result.itemsTotalCents).toBe(5200);
      expect(result.discountCents).toBe(500);
      expect(result.itemsTotalAfterDiscountCents).toBe(4700);
      expect(result.shippingCents).toBe(590);
      expect(result.totalCents).toBe(4700 + 590);
      expect(result.freeShippingRemainingCents).toBe(200);
    });
  });

  describe('Commande témoin officielle (docs/DECISIONS.md)', () => {
    it('calcule au centime près la ventilation de TVA et les totaux de la commande témoin', () => {
      // Article 1 : Thé Earl Grey 100 g (taux 5,5 %, PU TTC 12,90 €, qté 2)
      // Article 2 : Fleurs CBD 3 g (taux 20 %, PU TTC 14,90 €, qté 1)
      const lines = [
        {
          productName: 'Thé Earl Grey 100 g',
          unitPriceCents: 1290,
          quantity: 2,
          vatRateBps: DEFAULT_VAT_RATE_BPS, // 550 (5,5 %)
        },
        {
          productName: 'Fleurs CBD 3 g',
          unitPriceCents: 1490,
          quantity: 1,
          vatRateBps: STANDARD_VAT_RATE_BPS, // 2000 (20 %)
        },
      ];

      const result = service.calculateCartTotals(lines, {
        shippingMethod: {
          code: 'HOME',
          name: 'Livraison à domicile',
          priceCents: 590,
          freeFromCents: DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
        },
      });

      // 1. Sous-total articles
      expect(result.itemsCount).toBe(3);
      expect(result.itemsTotalCents).toBe(4070); // 40,70 €
      expect(result.discountCents).toBe(0);
      expect(result.shippingCents).toBe(590); // 5,90 €
      expect(result.totalCents).toBe(4660); // 46,60 €

      // 2. Ventilation de la TVA par taux
      expect(result.vatBreakdown).toHaveLength(2);

      const tranche55 = result.vatBreakdown.find((v) => v.rateBps === 550);
      const tranche20 = result.vatBreakdown.find((v) => v.rateBps === 2000);

      expect(tranche55).toBeDefined();
      expect(tranche20).toBeDefined();

      // Tranche 5,5 % : Base TTC = 29,71 €, HT = 28,16 €, TVA = 1,55 €
      expect(tranche55!.totalCents).toBe(2971);
      expect(tranche55!.baseCents).toBe(2816);
      expect(tranche55!.vatCents).toBe(155);

      // Tranche 20 % : Base TTC = 16,89 €, HT = 14,07 €, TVA = 2,82 €
      expect(tranche20!.totalCents).toBe(1689);
      expect(tranche20!.baseCents).toBe(1407);
      expect(tranche20!.vatCents).toBe(282);

      // 3. Contrôle des totaux
      const totalHt = tranche55!.baseCents + tranche20!.baseCents;
      const totalVat = tranche55!.vatCents + tranche20!.vatCents;
      expect(totalHt).toBe(4223); // 42,23 €
      expect(totalVat).toBe(437); // 4,37 €
      expect(totalHt + totalVat).toBe(4660); // 46,60 € exact
    });
  });

  describe('Cas limites et paniers vides', () => {
    it('gère correctement un panier vide', () => {
      const result = service.calculateCartTotals([]);

      expect(result.itemsCount).toBe(0);
      expect(result.itemsTotalCents).toBe(0);
      expect(result.discountCents).toBe(0);
      expect(result.itemsTotalAfterDiscountCents).toBe(0);
      expect(result.shippingCents).toBeNull();
      expect(result.totalCents).toBe(0);
      expect(result.freeShippingRemainingCents).toBe(
        DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
      );
      expect(result.vatBreakdown).toEqual([]);
    });
  });
});
