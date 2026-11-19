import { ServiceUnavailableException } from '@nestjs/common';

export enum Availability {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  UNKNOWN = 'UNKNOWN',
}

// Seuil déjà retenu dans le contrat d'API : 1 à 5 unités.
export const LOW_STOCK_THRESHOLD = 5;
export const MAX_ORDER_QUANTITY = 99;

export function stockUnavailable() {
  return new ServiceUnavailableException({
    code: 'STOCK_UNAVAILABLE',
    message: 'Stock momentanément non consultable. Réessayez plus tard.',
  });
}

export async function readStock<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch {
    throw stockUnavailable();
  }
}

export function availabilityOf(stock: unknown): Availability {
  if (typeof stock !== 'number' || !Number.isSafeInteger(stock) || stock < 0)
    return Availability.UNKNOWN;
  if (stock === 0) return Availability.OUT_OF_STOCK;
  return stock <= LOW_STOCK_THRESHOLD
    ? Availability.LOW_STOCK
    : Availability.IN_STOCK;
}

export function isAvailable(availability: Availability): boolean {
  return (
    availability === Availability.IN_STOCK ||
    availability === Availability.LOW_STOCK
  );
}

export function productAvailability(
  formats: readonly { stock: unknown }[] | undefined | null,
) {
  if (!formats)
    return { availability: Availability.UNKNOWN, isOrderable: false };
  const states = formats.map((format) => availabilityOf(format.stock));
  const availability = states.includes(Availability.IN_STOCK)
    ? Availability.IN_STOCK
    : states.includes(Availability.LOW_STOCK)
      ? Availability.LOW_STOCK
      : states.includes(Availability.UNKNOWN)
        ? Availability.UNKNOWN
        : Availability.OUT_OF_STOCK;
  return { availability, isOrderable: isAvailable(availability) };
}
