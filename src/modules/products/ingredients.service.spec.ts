import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Ingredient } from './entities/ingredient.entity';
import { IngredientType } from './enums/ingredient-type.enum';
import { IngredientsService } from './ingredients.service';

describe('IngredientsService', () => {
  let service: IngredientsService;
  const builder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getRawMany: jest.fn<() => Promise<unknown[]>>(),
  };
  const repository = { createQueryBuilder: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    repository.createQueryBuilder.mockReturnValue(builder);
    for (const method of [
      'select',
      'addSelect',
      'andWhere',
      'orderBy',
      'addOrderBy',
    ] as const)
      builder[method].mockReturnValue(builder);
    builder.getRawMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: getRepositoryToken(Ingredient), useValue: repository },
      ],
    }).compile();
    service = module.get(IngredientsService);
  });

  it('liste tout le référentiel, trié par nom puis UUID, sans condition', async () => {
    await service.findAll({});

    expect(builder.andWhere).not.toHaveBeenCalled();
    expect(builder.orderBy).toHaveBeenCalledWith('ingredient.name', 'ASC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('ingredient.id', 'ASC');
  });

  it('compte uniquement les produits publiés et convertit le compteur en nombre', async () => {
    builder.getRawMany.mockResolvedValue([
      {
        id: 'a',
        name: 'Anis étoilé',
        type: IngredientType.DRIED_INGREDIENT,
        aliases: ['badiane'],
        productCount: '3',
      },
    ]);

    const result = await service.findAll({});

    const countSql = builder.addSelect.mock.calls.find(
      ([, alias]) => alias === 'productCount',
    )![0];
    expect(String(countSql)).toContain('product.published');
    expect(result).toEqual([
      {
        id: 'a',
        name: 'Anis étoilé',
        type: IngredientType.DRIED_INGREDIENT,
        aliases: ['badiane'],
        productCount: 3,
      },
    ]);
  });

  it('ajoute une condition par mot, sur le nom ou un synonyme', async () => {
    await service.findAll({ q: 'menthe poivrée' });

    expect(builder.andWhere).toHaveBeenCalledTimes(2);
    const [sql, parameters] = builder.andWhere.mock.calls[1];
    expect(parameters).toEqual({ search1: '%poivrée%' });
    expect(String(sql)).toContain(
      'lower(unaccent(ingredient.name)) LIKE lower(unaccent(:search1))',
    );
    expect(String(sql)).toContain('unnest(ingredient.aliases) synonym');
  });

  it('renvoie 503 STOCK_UNAVAILABLE si la base est illisible', async () => {
    builder.getRawMany.mockRejectedValue(new Error('connexion perdue'));

    await expect(service.findAll({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
