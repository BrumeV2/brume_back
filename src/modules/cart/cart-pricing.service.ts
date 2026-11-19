import { Injectable, Logger } from '@nestjs/common';

export const DEFAULT_VAT_RATE_BPS = 550; // 5.5 % (thé, café, infusions)
export const STANDARD_VAT_RATE_BPS = 2000; // 20.0 % (CBD, accessoires)
export const DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS = 4900; // 49.00 € TTC (D-008)

export interface DiscountInput {
  code?: string;
  type: 'FIXED' | 'PERCENTAGE';
  amountCents?: number;
  rateBps?: number;
}

export interface ShippingMethodInput {
  code: string;
  name?: string;
  carrier?: string;
  priceCents: number;
  freeFromCents?: number | null;
}

export interface PricingLineInput {
  unitPriceCents: number;
  quantity: number;
  vatRateBps?: number;
  productName?: string;
}

export interface VatBreakdownLine {
  rateBps: number;
  baseCents: number;
  vatCents: number;
  totalCents: number;
}

export interface CartTotalsResult {
  itemsCount: number;
  itemsTotalCents: number;
  discountCents: number;
  itemsTotalAfterDiscountCents: number;
  shippingCents: number | null;
  totalCents: number;
  freeShippingRemainingCents: number | null;
  vatBreakdown: VatBreakdownLine[];
}

export interface CartPricingOptions {
  discount?: DiscountInput | null;
  shippingMethod?: ShippingMethodInput | null;
  freeShippingThresholdCents?: number;
}

@Injectable()
export class CartPricingService {
  private readonly logger = new Logger(CartPricingService.name);

  /**
   * Arrondi demi-supérieur standard (half-up) pour les montants monétaires en centimes.
   */
  roundHalfUp(value: number): number {
    return Math.sign(value) * Math.round(Math.abs(value));
  }

  /**
   * Calcule le total TTC d'une ligne selon D-007 (prix unitaire x quantité).
   */
  calculateLineTotal(unitPriceCents: number, quantity: number): number {
    if (unitPriceCents < 0 || quantity < 0) {
      throw new Error('Le prix unitaire et la quantite doivent etre positifs.');
    }
    return Math.round(unitPriceCents) * Math.round(quantity);
  }

  /**
   * Calcule le montant de la remise déduit selon D-014.
   * La remise est plafonnée au sous-total des articles.
   */
  calculateDiscount(
    itemsTotalCents: number,
    discount?: DiscountInput | null,
  ): number {
    if (!discount || itemsTotalCents <= 0) {
      return 0;
    }

    if (discount.type === 'FIXED') {
      const fixedAmount = Math.max(0, Math.round(discount.amountCents ?? 0));
      return Math.min(itemsTotalCents, fixedAmount);
    }

    if (discount.type === 'PERCENTAGE') {
      const rateBps = Math.max(0, Math.round(discount.rateBps ?? 0));
      const calculated = this.roundHalfUp((itemsTotalCents * rateBps) / 10000);
      return Math.min(itemsTotalCents, Math.max(0, calculated));
    }

    return 0;
  }

  /**
   * Calcule les frais de port et le restant pour livraison offerte (D-008, D-014).
   * Si aucun mode de livraison n'est fourni, shippingCents vaut null (montant encore inconnu au panier).
   */
  calculateShipping(
    itemsTotalAfterDiscountCents: number,
    shippingMethod?: ShippingMethodInput | null,
    defaultThresholdCents: number = DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
  ): {
    shippingCents: number | null;
    freeShippingRemainingCents: number | null;
  } {
    const threshold =
      shippingMethod?.freeFromCents !== undefined &&
      shippingMethod.freeFromCents !== null
        ? shippingMethod.freeFromCents
        : defaultThresholdCents;

    const remainingForFreeShipping =
      threshold > 0
        ? Math.max(0, threshold - itemsTotalAfterDiscountCents)
        : null;

    if (!shippingMethod) {
      return {
        shippingCents: null,
        freeShippingRemainingCents: remainingForFreeShipping,
      };
    }

    const isFree = threshold > 0 && itemsTotalAfterDiscountCents >= threshold;

    return {
      shippingCents: isFree ? 0 : Math.max(0, shippingMethod.priceCents),
      freeShippingRemainingCents: isFree ? 0 : remainingForFreeShipping,
    };
  }

  /**
   * Calcule l'ensemble des totaux du panier avec ventilation exacte de TVA (D-004 à D-009, D-014).
   */
  calculateCartTotals(
    lines: PricingLineInput[],
    options?: CartPricingOptions,
  ): CartTotalsResult {
    let itemsCount = 0;
    let itemsTotalCents = 0;

    interface GroupedRate {
      rateBps: number;
      ttcArticlesCents: number;
      htArticlesCents: number;
    }

    const ratesMap = new Map<number, GroupedRate>();

    for (const line of lines) {
      const lineTotal = this.calculateLineTotal(
        line.unitPriceCents,
        line.quantity,
      );
      itemsCount += line.quantity;
      itemsTotalCents += lineTotal;

      const rateBps = line.vatRateBps ?? DEFAULT_VAT_RATE_BPS;
      const rateDecimal = rateBps / 10000;
      const lineHt = lineTotal / (1 + rateDecimal);

      const existing = ratesMap.get(rateBps);
      if (existing) {
        existing.ttcArticlesCents += lineTotal;
        existing.htArticlesCents += lineHt;
      } else {
        ratesMap.set(rateBps, {
          rateBps,
          ttcArticlesCents: lineTotal,
          htArticlesCents: lineHt,
        });
      }
    }

    const discountCents = this.calculateDiscount(
      itemsTotalCents,
      options?.discount,
    );
    const itemsTotalAfterDiscountCents = Math.max(
      0,
      itemsTotalCents - discountCents,
    );

    const { shippingCents, freeShippingRemainingCents } =
      this.calculateShipping(
        itemsTotalAfterDiscountCents,
        options?.shippingMethod,
        options?.freeShippingThresholdCents ??
          DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
      );

    const effectiveShippingCents = shippingCents ?? 0;
    const totalCents = itemsTotalAfterDiscountCents + effectiveShippingCents;

    if (ratesMap.size === 0 || itemsTotalCents === 0) {
      return {
        itemsCount,
        itemsTotalCents: 0,
        discountCents: 0,
        itemsTotalAfterDiscountCents: 0,
        shippingCents,
        totalCents: effectiveShippingCents,
        freeShippingRemainingCents,
        vatBreakdown: [],
      };
    }

    const totalArticlesHt = Array.from(ratesMap.values()).reduce(
      (sum, group) => sum + group.htArticlesCents,
      0,
    );

    const groups = Array.from(ratesMap.values()).sort(
      (a, b) => a.rateBps - b.rateBps,
    );

    let allocatedDiscount = 0;
    let allocatedShipping = 0;
    const vatBreakdown: VatBreakdownLine[] = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const isLast = i === groups.length - 1;
      const ratio =
        totalArticlesHt > 0 ? group.htArticlesCents / totalArticlesHt : 0;

      // Ventilation remise au prorata du HT des articles (D-014)
      let trancheDiscount = 0;
      if (discountCents > 0) {
        trancheDiscount = isLast
          ? discountCents - allocatedDiscount
          : this.roundHalfUp(discountCents * ratio);
        allocatedDiscount += trancheDiscount;
      }

      // Ventilation livraison au prorata du HT des articles (D-009)
      let trancheShipping = 0;
      if (effectiveShippingCents > 0) {
        trancheShipping = isLast
          ? effectiveShippingCents - allocatedShipping
          : this.roundHalfUp(effectiveShippingCents * ratio);
        allocatedShipping += trancheShipping;
      }

      const trancheTtc = Math.max(
        0,
        group.ttcArticlesCents - trancheDiscount + trancheShipping,
      );
      const rateDecimal = group.rateBps / 10000;

      // TVA = round(TTC * taux / (1 + taux)) (D-007)
      const trancheVat = this.roundHalfUp(
        (trancheTtc * rateDecimal) / (1 + rateDecimal),
      );
      const trancheHt = trancheTtc - trancheVat;

      vatBreakdown.push({
        rateBps: group.rateBps,
        baseCents: trancheHt,
        vatCents: trancheVat,
        totalCents: trancheTtc,
      });
    }

    return {
      itemsCount,
      itemsTotalCents,
      discountCents,
      itemsTotalAfterDiscountCents,
      shippingCents,
      totalCents,
      freeShippingRemainingCents,
      vatBreakdown,
    };
  }
}
