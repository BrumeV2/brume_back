import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { flattenValidationErrors } from '../../../app.setup';
import { CreateProductDto } from './create-product.dto';

const BASE_ID = '00000000-0000-4000-8000-000000000001';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: '  Assam Bergamote ',
    howMuchCaffeine: 'high',
    moment: 'morning',
    ingredientIds: [BASE_ID],
    formats: [
      { sku: ' assam-bag-50 ', packaging: 'bag', quantity: 50, price: 590 },
    ],
    ...overrides,
  };
}

async function check(overrides: Record<string, unknown> = {}) {
  const dto = plainToInstance(CreateProductDto, payload(overrides));
  return { dto, errors: flattenValidationErrors(await validate(dto)) };
}

describe('CreateProductDto', () => {
  it('normalise un produit minimal et le crée en brouillon', async () => {
    const { dto, errors } = await check({ origin: '  ', typeTea: ' noir ' });
    expect(errors).toEqual([]);
    expect(dto.name).toBe('Assam Bergamote');
    expect(dto.origin).toBeNull();
    expect(dto.typeTea).toBe('noir');
    expect(dto.published).toBe(false);
    expect(dto.formats[0]).toMatchObject({ sku: 'ASSAM-BAG-50', stock: 0 });
  });

  it.each([
    ['nom vide', { name: '   ' }, 'name'],
    ['caféine inconnue', { howMuchCaffeine: 'extreme' }, 'howMuchCaffeine'],
    ['sans ingrédient', { ingredientIds: [] }, 'ingredientIds'],
    [
      'ingrédient en double',
      { ingredientIds: [BASE_ID, BASE_ID.toUpperCase()] },
      'ingredientIds',
    ],
    ['sans format', { formats: [] }, 'formats'],
    ['publication non booléenne', { published: 'yes' }, 'published'],
  ])('refuse : %s', async (_label, overrides, field) => {
    const { errors } = await check(overrides);
    expect(errors.map((error) => error.field)).toContain(field);
  });

  it('désigne le champ fautif d’un format', async () => {
    const { errors } = await check({
      formats: [
        { sku: 'OK-1', packaging: 'bag', quantity: 50, price: 590 },
        {
          sku: 'mauvaise ref!',
          packaging: 'pot',
          quantity: 0,
          price: -1,
          stock: -2,
        },
      ],
    });
    expect(errors.map((error) => error.field).sort()).toEqual([
      'formats.1.packaging',
      'formats.1.price',
      'formats.1.quantity',
      'formats.1.sku',
      'formats.1.stock',
    ]);
  });

  it('refuse les références et conditionnements répétés dans la requête', async () => {
    const { errors } = await check({
      formats: [
        { sku: 'ASSAM-50', packaging: 'bag', quantity: 50, price: 590 },
        { sku: 'assam-50', packaging: 'bag', quantity: 50, price: 690 },
      ],
    });
    expect(errors).toEqual([
      {
        field: 'formats',
        constraints: ['uniquePackagingQuantity', 'uniqueSku'],
      },
    ]);
  });
});
