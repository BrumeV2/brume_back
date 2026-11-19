import {
  Availability,
  availabilityOf,
  isAvailable,
  productAvailability,
  readStock,
} from './availability/availability';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { CatalogueFiltersDto } from './dto/catalogue-filters.dto';
import { CatalogueFormatDto } from './dto/catalogue-format.dto';
import { CatalogueQueryDto } from './dto/catalogue-query.dto';
import { CatalogueProductDto } from './dto/catalogue-product.dto';
import { ProductDetailDto } from './dto/product-detail.dto';
import { ProductFormat } from './entities/product-format.entity';
import { Product } from './entities/product.entity';
import { CaffeineLevel } from './enums/caffeine-level.enum';
import { CatalogueSort } from './enums/catalogue-sort.enum';
import { ProfileProductType } from './enums/profile-product-type.enum';
import { ConsumptionMoment } from './enums/consumption-moment.enum';
import { IngredientType } from './enums/ingredient-type.enum';

// Ordre d'affichage des ingrédients : la base d'abord, puis les aromatisations
const ingredientTypeOrder = Object.values(IngredientType);

// « Dans le même esprit » : poids du score de similarité et nombre de suggestions
const SHARED_INGREDIENT_WEIGHT = 3;
const SAME_TEA_TYPE_WEIGHT = 2;
const SIMILAR_PRODUCTS_COUNT = 3;

// Indicateurs du catalogue, calculés par produit (une ligne par produit, sans jointure)
const LOWEST_PRICE_SQL = `(SELECT MIN(format.price) FROM product_formats format WHERE format."productId" = product.id)`;
// AVG et COUNT ignorent les avis sans note
const AVERAGE_RATING_SQL = `(SELECT AVG(link.note) FROM profile_products link WHERE link."productId" = product.id AND link.type = :reviewType)`;
const RATING_COUNT_SQL = `(SELECT COUNT(link.note) FROM profile_products link WHERE link."productId" = product.id AND link.type = :reviewType)`;

interface IndicatorsRow {
  id: string;
  lowestPrice: number | null;
  // numeric et bigint arrivent en chaîne depuis pg
  averageRating: string | null;
  ratingCount: string | number;
}

// Clés de tri ; product.id ASC est toujours ajouté en dernier.
// Les alias calculés sont triés NULLS LAST : un produit sans prix ou sans note finit la liste.
type SortKey = [string, 'ASC' | 'DESC', ('NULLS FIRST' | 'NULLS LAST')?];
const SORT_ORDERS: Record<CatalogueSort, SortKey[]> = {
  [CatalogueSort.NAME_ASC]: [['product.name', 'ASC']],
  [CatalogueSort.NAME_DESC]: [['product.name', 'DESC']],
  [CatalogueSort.PRICE_ASC]: [
    ['"lowestPrice"', 'ASC', 'NULLS LAST'],
    ['product.name', 'ASC'],
  ],
  [CatalogueSort.PRICE_DESC]: [
    ['"lowestPrice"', 'DESC', 'NULLS LAST'],
    ['product.name', 'ASC'],
  ],
  [CatalogueSort.NEWEST]: [
    ['product.createdAt', 'DESC'],
    ['product.name', 'ASC'],
  ],
  [CatalogueSort.RATING_DESC]: [
    ['"averageRating"', 'DESC', 'NULLS LAST'],
    ['"ratingCount"', 'DESC'],
    ['product.name', 'ASC'],
  ],
};

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
    const builder = this.indicatorsQuery();
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
    const total = await readStock(() => builder.getCount());

    // Tri global avant la pagination ; l'UUID garantit un ordre total et stable entre les pages
    for (const [column, direction, nulls] of SORT_ORDERS[query.sort])
      builder.addOrderBy(column, direction, nulls);
    const rows = await readStock(() =>
      builder
        .addOrderBy('product.id', 'ASC')
        .offset((query.page - 1) * query.limit)
        .limit(query.limit)
        .getRawMany<IndicatorsRow>(),
    );

    return new PaginatedResponseDto(
      await this.toCatalogueProducts(rows),
      total,
      query,
    );
  }

  async findOne(id: string): Promise<ProductDetailDto> {
    const product = await readStock(() =>
      this.productsRepository.findOne({
        where: { id },
        relations: { ingredients: true, formats: true },
      }),
    );
    if (!product) throw new NotFoundException();

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      typeTea: product.typeTea,
      origin: product.origin,
      howMuchCaffeine: product.howMuchCaffeine,
      moment: product.moment,
      image: product.image,
      ingredients: [...product.ingredients]
        .sort(
          (a, b) =>
            ingredientTypeOrder.indexOf(a.type) -
              ingredientTypeOrder.indexOf(b.type) ||
            a.name.localeCompare(b.name),
        )
        .map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          description: ingredient.description,
          type: ingredient.type,
        })),
      ...productAvailability(product.formats),
      formats: toFormatDtos(product.formats),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async findSimilar(id: string): Promise<CatalogueProductDto[]> {
    if (!(await readStock(() => this.productsRepository.existsBy({ id })))) {
      throw new NotFoundException();
    }

    // Score = ingrédients communs hors base (la base recoupe le type de thé) + même type de thé.
    // Égalités départagées par le moment, puis la caféine, puis le nom.
    // Les produits sans aucun format en stock ne sont pas suggérés.
    const rows: { id: string }[] = await readStock(() =>
      this.productsRepository.query(
        `SELECT candidate.id
       FROM products candidate
       JOIN products target ON target.id = $1
       WHERE candidate.id <> target.id
         AND EXISTS (
           SELECT 1 FROM product_formats format
           WHERE format."productId" = candidate.id AND format.stock > 0
         )
       ORDER BY
         $2 * (
           SELECT count(*)
           FROM product_ingredients shared
           JOIN product_ingredients target_ingredient
             ON target_ingredient."ingredientId" = shared."ingredientId"
            AND target_ingredient."productId" = target.id
           JOIN ingredients ingredient ON ingredient.id = shared."ingredientId"
           WHERE shared."productId" = candidate.id AND ingredient.type <> $3
         )
         + CASE WHEN candidate."typeTea" = target."typeTea" THEN $4 ELSE 0 END DESC,
         candidate.moment = target.moment DESC,
         candidate."howMuchCaffeine" = target."howMuchCaffeine" DESC,
         candidate.name ASC,
         candidate.id ASC
       LIMIT $5`,
        [
          id,
          SHARED_INGREDIENT_WEIGHT,
          IngredientType.BASE,
          SAME_TEA_TYPE_WEIGHT,
          SIMILAR_PRODUCTS_COUNT,
        ],
      ),
    );
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);

    const indicators = await readStock(() =>
      this.indicatorsQuery()
        .where('product.id IN (:...ids)', { ids })
        .getRawMany<IndicatorsRow>(),
    );

    // la requête des indicateurs ne conserve pas l'ordre du score
    return this.toCatalogueProducts(
      indicators.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)),
    );
  }

  // Une ligne par produit avec les indicateurs exposés et utilisés par les tris
  private indicatorsQuery() {
    return this.productsRepository
      .createQueryBuilder('product')
      .select('product.id', 'id')
      .addSelect(LOWEST_PRICE_SQL, 'lowestPrice')
      .addSelect(AVERAGE_RATING_SQL, 'averageRating')
      .addSelect(RATING_COUNT_SQL, 'ratingCount')
      .setParameter('reviewType', ProfileProductType.REVIEW);
  }

  // Charge les ingrédients des produits et conserve l'ordre des lignes reçues
  private async toCatalogueProducts(
    rows: IndicatorsRow[],
  ): Promise<CatalogueProductDto[]> {
    if (!rows.length) return [];
    const products = await readStock(() =>
      this.productsRepository.find({
        where: { id: In(rows.map((row) => row.id)) },
        relations: { ingredients: true, formats: true },
      }),
    );
    const byId = new Map(products.map((product) => [product.id, product]));
    return rows.flatMap((row) => {
      const product = byId.get(row.id);
      return product ? [toCatalogueProductDto(product, row)] : [];
    });
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
          (
            await readStock(() =>
              builder.distinct(true).getRawMany<{ value: string }>(),
            )
          ).map((row) => row.value),
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

function toCatalogueProductDto(
  product: Product,
  indicators: IndicatorsRow,
): CatalogueProductDto {
  return {
    id: product.id,
    name: product.name,
    typeTea: product.typeTea,
    origin: product.origin,
    ...productAvailability(product.formats),
    ingredients: product.ingredients.map((ingredient) => ingredient.name),
    moment: product.moment,
    image: product.image,
    lowestPrice:
      indicators.lowestPrice === null ? null : Number(indicators.lowestPrice),
    // AVG renvoie un numeric (chaîne côté pg) : arrondi à une décimale pour l'affichage
    averageRating:
      indicators.averageRating === null
        ? null
        : Math.round(Number(indicators.averageRating) * 10) / 10,
    ratingCount: Number(indicators.ratingCount),
  };
}

// Du moins cher au plus cher, puis du plus petit grammage au plus grand
function toFormatDtos(formats: ProductFormat[]): CatalogueFormatDto[] {
  return [...formats]
    .sort((a, b) => a.price - b.price || a.quantity - b.quantity)
    .map((format) => ({
      id: format.id,
      packaging: format.packaging,
      quantity: format.quantity,
      price: format.price,
      stock:
        availabilityOf(format.stock) === Availability.UNKNOWN
          ? null
          : format.stock,
      availability: availabilityOf(format.stock),
      isOrderable: isAvailable(availabilityOf(format.stock)),
    }));
}
