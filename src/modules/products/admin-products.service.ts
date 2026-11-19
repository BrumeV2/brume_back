import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { AdminProductDto } from './dto/admin-product.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { Ingredient } from './entities/ingredient.entity';
import { ProductFormat } from './entities/product-format.entity';
import { Product } from './entities/product.entity';
import { IngredientType } from './enums/ingredient-type.enum';

const SKU_UNIQUE_CONSTRAINT = 'UQ_product_formats_sku';
const UNIQUE_VIOLATION = '23505';
const ingredientTypeOrder = Object.values(IngredientType);

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // US-080 : produit, formats et ingrédients enregistrés dans une seule transaction.
  // Toute erreur annule l'ensemble : jamais de produit partiel.
  async create(
    dto: CreateProductDto,
    userId: string,
  ): Promise<AdminProductDto> {
    const skus = dto.formats.map((format) => format.sku);
    let product: Product;
    try {
      product = await this.dataSource.transaction((manager) =>
        this.insert(manager, dto, userId, skus),
      );
    } catch (error) {
      // Création concurrente d'une même référence entre le contrôle et l'insertion
      if (isSkuViolation(error)) throw skuConflict(dto, skus);
      throw error;
    }
    this.logger.log(
      `Produit créé id=${product.id} publié=${product.published} formats=${product.formats.length} par utilisateur=${userId}`,
    );
    return toAdminProductDto(product);
  }

  private async insert(
    manager: EntityManager,
    dto: CreateProductDto,
    userId: string,
    skus: string[],
  ): Promise<Product> {
    const ingredients = await manager.findBy(Ingredient, {
      id: In(dto.ingredientIds),
    });
    if (ingredients.length !== dto.ingredientIds.length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Un ou plusieurs ingrédients sont introuvables.',
        details: [{ field: 'ingredientIds', constraints: ['exists'] }],
      });

    const taken = await manager.find(ProductFormat, {
      select: { id: true, sku: true },
      where: { sku: In(skus) },
    });
    if (taken.length)
      throw skuConflict(
        dto,
        taken.map((format) => format.sku),
      );

    return manager.save(
      manager.create(Product, {
        name: dto.name,
        description: dto.description ?? null,
        origin: dto.origin ?? null,
        typeTea: dto.typeTea ?? null,
        image: dto.image ?? null,
        howMuchCaffeine: dto.howMuchCaffeine,
        moment: dto.moment,
        published: dto.published,
        createdById: userId,
        ingredients,
        formats: dto.formats.map((format) =>
          manager.create(ProductFormat, {
            sku: format.sku,
            packaging: format.packaging,
            quantity: format.quantity,
            price: format.price,
            stock: format.stock,
          }),
        ),
      }),
    );
  }
}

function isSkuViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return (
    driverError.code === UNIQUE_VIOLATION &&
    driverError.constraint === SKU_UNIQUE_CONSTRAINT
  );
}

// 409 conforme au contrat : VALIDATION_ERROR, un détail par format concerné
function skuConflict(dto: CreateProductDto, taken: string[]) {
  const fields = dto.formats.flatMap((format, index) =>
    taken.includes(format.sku) ? [`formats.${index}.sku`] : [],
  );
  return new ConflictException({
    code: 'VALIDATION_ERROR',
    message: 'Une ou plusieurs références de format sont déjà utilisées.',
    details: (fields.length ? fields : ['formats.sku']).map((field) => ({
      field,
      constraints: ['unique'],
    })),
  });
}

export function toAdminProductDto(product: Product): AdminProductDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    origin: product.origin,
    typeTea: product.typeTea,
    image: product.image,
    howMuchCaffeine: product.howMuchCaffeine,
    moment: product.moment,
    published: product.published,
    ingredients: [...product.ingredients]
      .sort(
        (a, b) =>
          ingredientTypeOrder.indexOf(a.type) -
            ingredientTypeOrder.indexOf(b.type) || a.name.localeCompare(b.name),
      )
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        type: ingredient.type,
      })),
    formats: [...product.formats]
      .sort((a, b) => a.price - b.price || a.quantity - b.quantity)
      .map((format) => ({
        id: format.id,
        sku: format.sku,
        packaging: format.packaging,
        quantity: format.quantity,
        price: format.price,
        stock: format.stock,
      })),
    createdById: product.createdById,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
