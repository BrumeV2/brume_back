import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { CartItemResponseDto } from './dto/cart-item-response.dto';
import { CartWarningDto } from './dto/cart-response.dto';
import { CartDiscrepancyDto } from './dto/cart-validation-response.dto';
import { CheckoutContext } from './interfaces/checkout-context.interface';

const DEFAULT_CONTEXT_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures (D-011)
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class CheckoutContextService implements OnModuleDestroy {
  private readonly logger = new Logger(CheckoutContextService.name);
  private readonly byCartId = new Map<string, CheckoutContext>();
  private readonly byContextId = new Map<string, CheckoutContext>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.purgeExpired();
    }, CLEANUP_INTERVAL_MS);
    this.cleanupInterval.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }

  get(contextId: string): CheckoutContext | null {
    const context = this.byContextId.get(contextId);
    if (!context) {
      return null;
    }
    if (Date.now() > context.expiresAt) {
      this.remove(context.cartId);
      return null;
    }
    return context;
  }

  getByCartId(cartId: string): CheckoutContext | null {
    const context = this.byCartId.get(cartId);
    if (!context) {
      return null;
    }
    if (Date.now() > context.expiresAt) {
      this.remove(cartId);
      return null;
    }
    return context;
  }

  save(context: CheckoutContext): void {
    this.byCartId.set(context.cartId, context);
    this.byContextId.set(context.id, context);
  }

  remove(cartId: string): void {
    const existing = this.byCartId.get(cartId);
    if (existing) {
      this.byCartId.delete(cartId);
      this.byContextId.delete(existing.id);
    }
  }

  /**
   * Création ou reprise idempotente d un contexte de checkout versionné.
   * Si le panier n a pas changé depuis la dernière validation, le même contexte
   * et le même numéro de version sont conservés.
   */
  createOrUpdateContext(params: {
    cartId: string;
    status: 'valid' | 'changed' | 'blocked' | 'empty';
    itemsCount: number;
    itemsTotalCents: number;
    items: CartItemResponseDto[];
    warnings: CartWarningDto[];
    discrepancies: CartDiscrepancyDto[];
  }): CheckoutContext {
    const existing = this.getByCartId(params.cartId);
    const now = new Date().toISOString();
    const expiresAt = Date.now() + DEFAULT_CONTEXT_TTL_MS;

    if (existing) {
      // Vérification d idempotence : les totaux et items ont-ils changé ?
      const isIdentical =
        existing.status === params.status &&
        existing.itemsTotalCents === params.itemsTotalCents &&
        existing.itemsCount === params.itemsCount &&
        existing.discrepancies.length === params.discrepancies.length &&
        existing.warnings.length === params.warnings.length;

      if (isIdentical) {
        this.logger.debug(
          `Reprise idempotente du contexte de checkout ${existing.id} (version ${existing.version}) pour le panier ${params.cartId}`,
        );
        // Prolongation de la validité
        existing.expiresAt = expiresAt;
        existing.updatedAt = now;
        return existing;
      }

      // Le panier a évolué : nouvelle version
      const updated: CheckoutContext = {
        id: existing.id,
        cartId: params.cartId,
        version: existing.version + 1,
        status: params.status,
        itemsCount: params.itemsCount,
        itemsTotalCents: params.itemsTotalCents,
        items: params.items,
        warnings: params.warnings,
        discrepancies: params.discrepancies,
        createdAt: existing.createdAt,
        updatedAt: now,
        expiresAt,
      };

      this.save(updated);
      this.logger.log(
        `Mise a jour du contexte de checkout ${updated.id} a la version ${updated.version} pour le panier ${params.cartId}`,
      );
      return updated;
    }

    // Nouveau contexte (version 1)
    const newContext: CheckoutContext = {
      id: randomUUID(),
      cartId: params.cartId,
      version: 1,
      status: params.status,
      itemsCount: params.itemsCount,
      itemsTotalCents: params.itemsTotalCents,
      items: params.items,
      warnings: params.warnings,
      discrepancies: params.discrepancies,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    this.save(newContext);
    this.logger.log(
      `Creation du contexte de checkout ${newContext.id} (version 1) pour le panier ${params.cartId}`,
    );
    return newContext;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [cartId, context] of this.byCartId.entries()) {
      if (now > context.expiresAt) {
        this.byCartId.delete(cartId);
        this.byContextId.delete(context.id);
      }
    }
  }
}
