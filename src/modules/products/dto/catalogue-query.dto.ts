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
import { ConsumptionMoment } from '../enums/consumption-moment.enum';

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
    type: [String],
    format: 'uuid',
    maxItems: 20,
    description:
      'UUID des ingrédients liés au catalogue. Répéter le paramètre pour plusieurs valeurs (OU).',
  })
  @IsOptional()
  @Selection(true)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  ingredients?: string[];

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
}
