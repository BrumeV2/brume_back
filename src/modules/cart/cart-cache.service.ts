import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { CartCache } from './interfaces/cart-cache.interface';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

@Injectable()
export class CartCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CartCacheService.name);
  private readonly store = new Map<string, CartCache>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Nettoyage régulier des entrées expirées toutes les heures
    this.cleanupInterval = setInterval(
      () => {
        this.purgeExpired();
      },
      60 * 60 * 1000,
    );
    // Unref pour ne pas empêcher Node.js de quitter lors des tests
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  get(cartId: string): CartCache | null {
    const cart = this.store.get(cartId);
    if (!cart) {
      return null;
    }
    if (Date.now() > cart.expiresAt) {
      this.store.delete(cartId);
      return null;
    }
    return cart;
  }

  set(cart: CartCache, ttlMs: number = DEFAULT_TTL_MS): void {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(cart.id, {
      ...cart,
      expiresAt,
    });
  }

  delete(cartId: string): void {
    this.store.delete(cartId);
  }

  clear(): void {
    this.store.clear();
  }

  private purgeExpired(): void {
    const now = Date.now();
    let purged = 0;
    for (const [id, cart] of this.store.entries()) {
      if (now > cart.expiresAt) {
        this.store.delete(id);
        purged++;
      }
    }
    if (purged > 0) {
      this.logger.log(
        `Nettoyage du cache panier : ${purged} session(s) expiree(s) supprimee(s)`,
      );
    }
  }
}
