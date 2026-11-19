import { CartCacheService } from './cart-cache.service';
import type { CartCache } from './interfaces/cart-cache.interface';

describe('CartCacheService', () => {
  let service: CartCacheService;

  beforeEach(() => {
    service = new CartCacheService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('renvoie null si le panier n existe pas', () => {
    expect(service.get('unknown-cart-id')).toBeNull();
  });

  it('enregistre et retrouve un panier en cache', () => {
    const cart: CartCache = {
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          itemType: 'format',
          formatId: 'fmt-1',
          quantity: 2,
          unitPrice: 1200,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() + 10000,
    };

    service.set(cart);
    const retrieved = service.get('cart-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('cart-1');
    expect(retrieved?.items).toHaveLength(1);
    expect(retrieved?.items[0].formatId).toBe('fmt-1');
  });

  it('considère un panier expiré comme null et le supprime du cache', () => {
    const expiredCart: CartCache = {
      id: 'cart-expired',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() - 1000, // déjà expiré
    };

    service.set(expiredCart, -1000);
    expect(service.get('cart-expired')).toBeNull();
  });

  it('supprime un panier avec delete', () => {
    const cart: CartCache = {
      id: 'cart-to-delete',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() + 10000,
    };

    service.set(cart);
    expect(service.get('cart-to-delete')).not.toBeNull();

    service.delete('cart-to-delete');
    expect(service.get('cart-to-delete')).toBeNull();
  });

  it('vide tous les paniers avec clear', () => {
    service.set({
      id: 'c1',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() + 10000,
    });
    service.set({
      id: 'c2',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() + 10000,
    });

    service.clear();
    expect(service.get('c1')).toBeNull();
    expect(service.get('c2')).toBeNull();
  });
});
