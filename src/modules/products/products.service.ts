import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CatalogueFormatDto } from './dto/catalogue-format.dto';
import { CatalogueProductDto } from './dto/catalogue-product.dto';
import { ProductDetailDto } from './dto/product-detail.dto';
import { ProductFormat } from './entities/product-format.entity';
import { Product } from './entities/product.entity';
import { IngredientType } from './enums/ingredient-type.enum';

// Ordre d'affichage des ingrédients : la base d'abord, puis les aromatisations
const ingredientTypeOrder = Object.values(IngredientType);

// « Dans le même esprit » : poids du score de similarité et nombre de suggestions
const SHARED_INGREDIENT_WEIGHT = 3;
const SAME_TEA_TYPE_WEIGHT = 2;
const SIMILAR_PRODUCTS_COUNT = 3;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async findCatalogue(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<CatalogueProductDto>> {
    // Pagination sur les produits seuls : trier en SQL sur une relation fausse skip/take
    const [page, total] = await this.productsRepository.findAndCount({
      select: { id: true },
      order: { name: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const products = await this.productsRepository.find({
      where: { id: In(page.map((product) => product.id)) },
      relations: { ingredients: true },
      order: { name: 'ASC', id: 'ASC' },
    });

    return new PaginatedResponseDto(
      products.map(toCatalogueProductDto),
      total,
      query,
    );
  }

  async findOne(id: string): Promise<ProductDetailDto> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: { ingredients: true, formats: true },
    });
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
      formats: toFormatDtos(product.formats),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async findSimilar(id: string): Promise<CatalogueProductDto[]> {
    if (!(await this.productsRepository.existsBy({ id }))) {
      throw new NotFoundException();
    }

    // Score = ingrédients communs hors base (la base recoupe le type de thé) + même type de thé.
    // Égalités départagées par le moment, puis la caféine, puis le nom.
    // Les produits sans aucun format en stock ne sont pas suggérés.
    const rows: { id: string }[] = await this.productsRepository.query(
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
    );
    const ids = rows.map((row) => row.id);

    const products = await this.productsRepository.find({
      where: { id: In(ids) },
      relations: { ingredients: true },
    });

    // `find` ne conserve pas l'ordre du score
    return products
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      .map(toCatalogueProductDto);
  }
}

function toCatalogueProductDto(product: Product): CatalogueProductDto {
  return {
    id: product.id,
    name: product.name,
    typeTea: product.typeTea,
    origin: product.origin,
    ingredients: product.ingredients.map((ingredient) => ingredient.name),
    moment: product.moment,
    image: product.image,
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
      stock: format.stock,
    }));
}
