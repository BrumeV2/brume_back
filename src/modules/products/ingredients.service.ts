import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readStock } from './availability/availability';
import { IngredientListItemDto } from './dto/ingredient-list-item.dto';
import { IngredientsQueryDto } from './dto/ingredients-query.dto';
import { Ingredient } from './entities/ingredient.entity';
import { IngredientType } from './enums/ingredient-type.enum';
import { ingredientMatches, searchPatterns } from './search';

// Produits publiés contenant l'ingrédient
const PRODUCT_COUNT_SQL = `(SELECT COUNT(*) FROM product_ingredients pi JOIN products product ON product.id = pi."productId" WHERE pi."ingredientId" = ingredient.id AND product.published)`;

interface IngredientRow {
  id: string;
  name: string;
  type: IngredientType;
  aliases: string[];
  // bigint arrive en chaîne depuis pg
  productCount: string | number;
}

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
  ) {}

  // Référentiel complet (US-015), y compris les ingrédients sans produit publié
  async findAll(query: IngredientsQueryDto): Promise<IngredientListItemDto[]> {
    const builder = this.ingredientsRepository
      .createQueryBuilder('ingredient')
      .select('ingredient.id', 'id')
      .addSelect('ingredient.name', 'name')
      .addSelect('ingredient.type', 'type')
      .addSelect('ingredient.aliases', 'aliases')
      .addSelect(PRODUCT_COUNT_SQL, 'productCount');
    // ET entre les mots : chacun peut être trouvé dans le nom ou dans un synonyme
    if (query.q)
      searchPatterns(query.q).forEach((pattern, index) =>
        builder.andWhere(ingredientMatches('ingredient', `search${index}`), {
          [`search${index}`]: pattern,
        }),
      );
    const rows = await readStock(() =>
      builder
        .orderBy('ingredient.name', 'ASC')
        .addOrderBy('ingredient.id', 'ASC')
        .getRawMany<IngredientRow>(),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      aliases: row.aliases,
      productCount: Number(row.productCount),
    }));
  }
}
