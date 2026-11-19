import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProductFormat } from '../entities/product-format.entity';
import { AvailabilityService } from './availability.service';
import {
  Availability,
  availabilityOf,
  productAvailability,
} from './availability';

describe('Availability rules', () => {
  it.each([
    [0, Availability.OUT_OF_STOCK],
    [1, Availability.LOW_STOCK],
    [5, Availability.LOW_STOCK],
    [6, Availability.IN_STOCK],
    [99, Availability.IN_STOCK],
    [-1, Availability.UNKNOWN],
    [1.5, Availability.UNKNOWN],
    [null, Availability.UNKNOWN],
    [undefined, Availability.UNKNOWN],
    [NaN, Availability.UNKNOWN],
    [Infinity, Availability.UNKNOWN],
    ['10', Availability.UNKNOWN],
  ])('classifies stock %s', (stock, expected) => {
    expect(availabilityOf(stock)).toBe(expected);
  });
  it.each([
    [[], Availability.OUT_OF_STOCK, false],
    [[{ stock: 0 }, { stock: 1 }], Availability.LOW_STOCK, true],
    [[{ stock: 1 }, { stock: 6 }], Availability.IN_STOCK, true],
    [[{ stock: 0 }, { stock: null }], Availability.UNKNOWN, false],
    [[{ stock: null }, { stock: 2 }], Availability.LOW_STOCK, true],
  ] as const)(
    'aggregates product formats %j',
    (formats, availability, isOrderable) => {
      expect(productAvailability(formats)).toEqual({
        availability,
        isOrderable,
      });
    },
  );
  it('does not consider an unloaded relation a confirmed stockout', () => {
    expect(productAvailability(undefined)).toEqual({
      availability: Availability.UNKNOWN,
      isOrderable: false,
    });
  });
});

describe('AvailabilityService', () => {
  const repository = {
    findOne: jest.fn<() => Promise<ProductFormat | null>>(),
  };
  let service: AvailabilityService;
  beforeEach(() => {
    jest.resetAllMocks();
    service = new AvailabilityService(
      repository as unknown as Repository<ProductFormat>,
    );
  });
  it('accepts exactly the available stock, without changing it', async () => {
    const format = { stock: 3 } as ProductFormat;
    repository.findOne.mockResolvedValue(format);
    expect(await service.assertOrderable('p', 'f', 3)).toBe(format);
    expect(format.stock).toBe(3);
    expect(await service.check('p', 'f', 4)).toMatchObject({
      availability: Availability.LOW_STOCK,
      isOrderable: false,
    });
  });
  it('rechecks stock on every attempt and refuses a subsequent stockout', async () => {
    repository.findOne
      .mockResolvedValueOnce({ stock: 1 } as ProductFormat)
      .mockResolvedValueOnce({ stock: 0 } as ProductFormat);
    expect((await service.check('p', 'f')).isOrderable).toBe(true);
    await expect(service.assertOrderable('p', 'f', 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.findOne).toHaveBeenCalledTimes(2);
  });
  it.each([0, -1, 1.5, 100, NaN])(
    'rejects internal invalid quantity %s before reading stock',
    async (quantity) => {
      await expect(
        service.assertOrderable('p', 'f', quantity),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findOne).not.toHaveBeenCalled();
    },
  );
  it('rejects missing references', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.check('p', 'f')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it.each([null, -1, 1.5])(
    'fails closed on invalid stock %s',
    async (stock) => {
      repository.findOne.mockResolvedValue({ stock } as ProductFormat);
      await expect(service.assertOrderable('p', 'f', 1)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
  it('sanitizes storage failures without granting an order', async () => {
    repository.findOne.mockRejectedValue(
      new Error('secret SQL and database credentials'),
    );
    await expect(service.assertOrderable('p', 'f', 1)).rejects.toMatchObject({
      response: {
        code: 'STOCK_UNAVAILABLE',
        message: 'Stock momentanément non consultable. Réessayez plus tard.',
      },
    });
  });
});
