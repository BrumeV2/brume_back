import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CaffeineLevel } from '../enums/caffeine-level.enum';
import { CatalogueSort } from '../enums/catalogue-sort.enum';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { IngredientsMatch } from '../enums/ingredients-match.enum';
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  SearchText,
} from './search-text';

const Selection = (lowercase = false) =>
  Transform(({ value }: { value: unknown }) => {
    const values: unknown[] = Array.isArray(value) ? value : [value];
    return [
      ...new Set(
        values.map((item) =>
          typeof item === 'string'
            ? lowercase
              ? item.trim().toLowerCase()
              : item.trim()
            : item,
        ),
      ),
    ];
  });
const Integer = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  );

@ValidatorConstraint({ name: 'priceRange', async: false })
class PriceRange implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const min = (args.object as CatalogueQueryDto).minPrice;
    return typeof value !== 'number' || typeof min !== 'number' || value >= min;
  }
  defaultMessage() {
    return 'maxPrice doit être supérieur ou égal à minPrice.';
  }
}

export class CatalogueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    minLength: SEARCH_MIN_LENGTH,
    maxLength: SEARCH_MAX_LENGTH,
    description:
      'Recherche texte (US-014), valeur unique. Insensible à la casse et aux accents. Chaque mot doit figurer dans le nom, l’origine, le type de thé, le nom ou un synonyme d’un ingrédient (ET entre mots). Retirer le paramètre plutôt que l’envoyer vide.',
  })
  @SearchText()
  q?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 20,
    description:
      'UUID d’ingrédients du référentiel (GET /ingredients). Répéter le paramètre pour plusieurs valeurs, combinées selon ingredientsMatch.',
  })
  @IsOptional()
  @Selection(true)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  ingredients?: string[];

  @ApiPropertyOptional({
    enum: IngredientsMatch,
    default: IngredientsMatch.ANY,
    description:
      'Combinaison des ingrédients sélectionnés (US-015) : any = au moins un (OU), all = tous (ET). Sans effet sans ingredients.',
  })
  @IsOptional()
  @IsEnum(IngredientsMatch)
  ingredientsMatch: IngredientsMatch = IngredientsMatch.ANY;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    description:
      'Origines fournies par GET /products/filters. Paramètre répété, valeurs exactes (OU).',
  })
  @IsOptional()
  @Selection()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  origin?: string[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    description:
      'Types fournis par GET /products/filters. Paramètre répété, valeurs exactes (OU).',
  })
  @IsOptional()
  @Selection()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  typeTea?: string[];

  @ApiPropertyOptional({ enum: CaffeineLevel, isArray: true, maxItems: 20 })
  @IsOptional()
  @Selection()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsEnum(CaffeineLevel, { each: true })
  howMuchCaffeine?: CaffeineLevel[];

  @ApiPropertyOptional({ enum: ConsumptionMoment, isArray: true, maxItems: 20 })
  @IsOptional()
  @Selection()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsEnum(ConsumptionMoment, { each: true })
  moment?: ConsumptionMoment[];

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 2147483647,
    type: 'integer',
    description: 'Prix minimum inclus, en centimes, sur un format de vente.',
  })
  @IsOptional()
  @Integer()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minPrice?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 2147483647,
    type: 'integer',
    description:
      'Prix maximum inclus, en centimes. Un même format doit satisfaire les deux bornes.',
  })
  @IsOptional()
  @Integer()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  @Validate(PriceRange)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: CatalogueSort,
    default: CatalogueSort.NAME_ASC,
    description:
      'Tri global, appliqué avant la pagination. Égalités départagées par le nom puis l’UUID. price_* : prix du format le moins cher. rating_desc : note moyenne, puis nombre de notes. Produits sans prix ou sans note toujours en dernier.',
  })
  @IsOptional()
  @IsEnum(CatalogueSort)
  sort: CatalogueSort = CatalogueSort.NAME_ASC;
}
