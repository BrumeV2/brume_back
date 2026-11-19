import { ApiProperty } from '@nestjs/swagger';
import { CaffeineLevel } from '../enums/caffeine-level.enum';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { IngredientType } from '../enums/ingredient-type.enum';
import { Packaging } from '../enums/packaging.enum';

export class AdminProductIngredientDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: IngredientType }) type!: IngredientType;
}

// Format vu du back-office : référence et stock exact, sans indicateur public
export class AdminProductFormatDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'ASSAM-BAG-100' }) sku!: string;
  @ApiProperty({ enum: Packaging }) packaging!: Packaging;
  @ApiProperty({ type: 'integer', description: 'Grammage, en grammes.' })
  quantity!: number;
  @ApiProperty({ type: 'integer', description: 'Prix TTC, en centimes.' })
  price!: number;
  @ApiProperty({ type: 'integer' }) stock!: number;
}

export class AdminProductDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) origin!: string | null;
  @ApiProperty({ type: String, nullable: true }) typeTea!: string | null;
  @ApiProperty({ type: String, nullable: true }) image!: string | null;
  @ApiProperty({ enum: CaffeineLevel }) howMuchCaffeine!: CaffeineLevel;
  @ApiProperty({ enum: ConsumptionMoment }) moment!: ConsumptionMoment;
  @ApiProperty({
    description:
      'false : brouillon, absent du catalogue, de la fiche, des similaires et des filtres.',
  })
  published!: boolean;
  @ApiProperty({ type: [AdminProductIngredientDto] })
  ingredients!: AdminProductIngredientDto[];
  @ApiProperty({
    type: [AdminProductFormatDto],
    description: 'Du moins cher au plus cher, puis par grammage.',
  })
  formats!: AdminProductFormatDto[];
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Compte à l’origine de la création.',
  })
  createdById!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
