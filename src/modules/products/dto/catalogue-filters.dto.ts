import { ApiProperty } from '@nestjs/swagger';
import { CaffeineLevel } from '../enums/caffeine-level.enum';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';

export class IngredientFilterDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}
export class PriceFilterDto {
  @ApiProperty({
    type: 'integer',
    nullable: true,
    description: 'Centimes, null si aucun format.',
  })
  min!: number | null;
  @ApiProperty({
    type: 'integer',
    nullable: true,
    description: 'Centimes, null si aucun format.',
  })
  max!: number | null;
}
export class CatalogueFiltersDto {
  @ApiProperty({ type: [IngredientFilterDto] })
  ingredients!: IngredientFilterDto[];
  @ApiProperty({ type: [String] }) origin!: string[];
  @ApiProperty({ type: [String] }) typeTea!: string[];
  @ApiProperty({ enum: CaffeineLevel, isArray: true })
  howMuchCaffeine!: CaffeineLevel[];
  @ApiProperty({ enum: ConsumptionMoment, isArray: true })
  moment!: ConsumptionMoment[];
  @ApiProperty({ type: PriceFilterDto }) price!: PriceFilterDto;
}
