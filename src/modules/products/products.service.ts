import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { CatalogueQueryDto } from './dto/catalogue-query.dto';
import { CatalogueFiltersDto } from './dto/catalogue-filters.dto';
import { CaffeineLevel } from './enums/caffeine-level.enum';
import { ConsumptionMoment } from './enums/consumption-moment.enum';
import { CatalogueProductDto } from './dto/catalogue-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async findCatalogue(
    query: CatalogueQueryDto,
  ): Promise<PaginatedResponseDto<CatalogueProductDto>> {
    await this.validateSelections(query);
    // EXISTS filters retain one row per product, before pagination and counting.
    const builder = this.productsRepository
      .createQueryBuilder('product')
      .select('product.id');
    if (query.origin)
      builder.andWhere('BTRIM(product.origin) IN (:...origin)', {
        origin: query.origin,
      });
    if (query.typeTea)
      builder.andWhere('BTRIM(product.typeTea) IN (:...typeTea)', {
        typeTea: query.typeTea,
      });
    if (query.howMuchCaffeine)
      builder.andWhere('product.howMuchCaffeine IN (:...caffeine)', {
        caffeine: query.howMuchCaffeine,
      });
    if (query.moment)
      builder.andWhere('product.moment IN (:...moment)', {
        moment: query.moment,
      });
    if (query.ingredients)
      builder.andWhere(
        'EXISTS (SELECT 1 FROM product_ingredients pi WHERE pi."productId" = product.id AND pi."ingredientId" IN (:...ingredients))',
        { ingredients: query.ingredients },
      );
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const bounds: string[] = [];
      if (query.minPrice !== undefined)
        bounds.push('format.price >= :minPrice');
      if (query.maxPrice !== undefined)
        bounds.push('format.price <= :maxPrice');
      builder.andWhere(
        `EXISTS (SELECT 1 FROM product_formats format WHERE format."productId" = product.id AND ${bounds.join(' AND ')})`,
        { minPrice: query.minPrice, maxPrice: query.maxPrice },
      );
    }
    const [page, total] = await builder
      .orderBy('product.name', 'ASC')
      .addOrderBy('product.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    if (!page.length) return new PaginatedResponseDto([], total, query);

    const products = await this.productsRepository.find({
      where: { id: In(page.map((product) => product.id)) },
      relations: { ingredients: true, formats: true },
      order: { name: 'ASC', id: 'ASC' },
    });

    const data = products.map((product) => ({
      id: product.id,
      name: product.name,
      typeTea: product.typeTea,
      origin: product.origin,
      ingredients: product.ingredients.map((ingredient) => ingredient.name),
      price: Math.min(...product.formats.map((format) => format.price)),
      moment: product.moment,
      image: product.image,
      formats: product.formats
        .sort((a, b) => a.price - b.price || a.quantity - b.quantity)
        .map((format) => ({
          id: format.id,
          packaging: format.packaging,
          quantity: format.quantity,
          price: format.price,
          stock: format.stock,
        })),
    }));

    return new PaginatedResponseDto(data, total, query);
  }
  private async validateSelections(query: CatalogueQueryDto) {
    const checks = await Promise.all(
      (['origin', 'typeTea', 'ingredients'] as const).map(async (field) => {
        const values = query[field];
        if (!values) return null;
        const builder = this.productsRepository.createQueryBuilder('product');
        if (field === 'ingredients') {
          builder
            .innerJoin('product.ingredients', 'ingredient')
            .select('ingredient.id', 'value')
            .where('ingredient.id IN (:...values)', { values });
        } else {
          builder
            .select(`BTRIM(product.${field})`, 'value')
            .where(`BTRIM(product.${field}) IN (:...values)`, { values });
        }
        const available = new Set(
          (await builder.distinct(true).getRawMany<{ value: string }>()).map(
            (row) => row.value,
          ),
        );
        return values.every((value) => available.has(value))
          ? null
          : { field, constraints: ['isAllowed'] };
      }),
    );
    const details = checks.filter((check) => check !== null);
    if (details.length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Valeur de filtre non autorisée. Consultez les choix du catalogue.',
        details,
      });
  }

  async filters(): Promise<CatalogueFiltersDto> {
    const [values, ingredients, price] = await Promise.all([
      this.productsRepository
        .createQueryBuilder('product')
        .select([
          `array_remove(array_agg(DISTINCT NULLIF(BTRIM(product.origin), '')), NULL) AS origin`,
          `array_remove(array_agg(DISTINCT NULLIF(BTRIM(product.typeTea), '')), NULL) AS "typeTea"`,
          `array_agg(DISTINCT product."howMuchCaffeine"::text) AS caffeine`,
          `array_agg(DISTINCT product.moment::text) AS moment`,
        ])
        .getRawOne<{
          origin: string[] | null;
          typeTea: string[] | null;
          caffeine: string[] | null;
          moment: string[] | null;
        }>(),
      this.productsRepository
        .createQueryBuilder('product')
        .innerJoin('product.ingredients', 'ingredient')
        .select('ingredient.id', 'id')
        .addSelect('ingredient.name', 'name')
        .distinct(true)
        .orderBy('ingredient.name', 'ASC')
        .addOrderBy('ingredient.id', 'ASC')
        .getRawMany<{ id: string; name: string }>(),
      this.productsRepository
        .createQueryBuilder('product')
        .innerJoin('product.formats', 'format')
        .select('MIN(format.price)', 'min')
        .addSelect('MAX(format.price)', 'max')
        .getRawOne<{ min: number | null; max: number | null }>(),
    ]);
    return {
      ingredients,
      origin: (values?.origin ?? []).sort(),
      typeTea: (values?.typeTea ?? []).sort(),
      howMuchCaffeine: Object.values(CaffeineLevel).filter((value) =>
        values?.caffeine?.includes(value),
      ),
      moment: Object.values(ConsumptionMoment).filter((value) =>
        values?.moment?.includes(value),
      ),
      price: { min: price?.min ?? null, max: price?.max ?? null },
    };
  }
}
