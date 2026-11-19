import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidateNested,
} from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { SKU_PATTERN } from '../entities/product-format.entity';
import { CaffeineLevel } from '../enums/caffeine-level.enum';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { Packaging } from '../enums/packaging.enum';

const MAX_INT = 2147483647;
export const MAX_FORMATS = 20;
export const MAX_INGREDIENTS = 50;

// Texte obligatoire : espaces de bord retirés
const Trimmed = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
// Texte facultatif : espaces de bord retirés, chaîne vide enregistrée comme null
const OptionalText = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

// Doublons dans la requête elle-même ; les doublons avec la base sont contrôlés par le service
const distinctBy =
  (key: (format: CreateProductFormatDto) => unknown) => (value: unknown) =>
    !Array.isArray(value) ||
    new Set(value.map((format: CreateProductFormatDto) => key(format))).size ===
      value.length;

@ValidatorConstraint({ name: 'uniqueSku', async: false })
class UniqueSkus implements ValidatorConstraintInterface {
  validate = distinctBy((format) => format?.sku);
  defaultMessage() {
    return 'Chaque format doit avoir une référence distincte.';
  }
}

@ValidatorConstraint({ name: 'uniquePackagingQuantity', async: false })
class UniquePackagingQuantities implements ValidatorConstraintInterface {
  validate = distinctBy((format) => `${format?.packaging}:${format?.quantity}`);
  defaultMessage() {
    return 'Chaque format doit avoir un couple conditionnement + grammage distinct.';
  }
}

export class CreateProductFormatDto {
  @ApiProperty({
    pattern: SKU_PATTERN.source,
    example: 'ASSAM-BAG-100',
    description:
      'Référence unique dans tout le catalogue. Mise en majuscules et sans espaces de bord.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(SKU_PATTERN)
  sku!: string;

  @ApiProperty({ enum: Packaging })
  @IsEnum(Packaging)
  packaging!: Packaging;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 100000,
    description: 'Grammage, en grammes.',
  })
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: MAX_INT,
    description: 'Prix TTC, en centimes.',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_INT)
  price!: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: MAX_INT,
    default: 0,
    description: 'Stock initial.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  stock: number = 0;
}

export class CreateProductDto {
  @ApiProperty({ maxLength: 150 })
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @OptionalText()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @OptionalText()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  origin?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    example: 'noir',
  })
  @OptionalText()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  typeTea?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Image encodée en base64 (data URI).',
  })
  @OptionalText()
  @IsOptional()
  @IsString()
  image?: string | null;

  @ApiProperty({ enum: CaffeineLevel })
  @IsEnum(CaffeineLevel)
  howMuchCaffeine!: CaffeineLevel;

  @ApiProperty({ enum: ConsumptionMoment })
  @IsEnum(ConsumptionMoment)
  moment!: ConsumptionMoment;

  @ApiPropertyOptional({
    default: false,
    description:
      'false (défaut) : brouillon, invisible sur les routes publiques. true : visible dès la création.',
  })
  @IsOptional()
  @IsBoolean()
  published: boolean = false;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: MAX_INGREDIENTS,
    description:
      'UUID d’ingrédients existants (GET /ingredients), sans doublon.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_INGREDIENTS)
  @IsUUID('4', { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @ArrayUnique()
  ingredientIds!: string[];

  @ApiProperty({
    type: [CreateProductFormatDto],
    minItems: 1,
    maxItems: MAX_FORMATS,
    description:
      'Formats de vente. Références et couples conditionnement + grammage distincts.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_FORMATS)
  @ValidateNested({ each: true })
  @Type(() => CreateProductFormatDto)
  @Validate(UniqueSkus)
  @Validate(UniquePackagingQuantities)
  formats!: CreateProductFormatDto[];
}
