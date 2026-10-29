import { ApiProperty } from '@nestjs/swagger';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';

export class CatalogueProductDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty({ type: String, nullable: true })
  typeTea: string | null;
  @ApiProperty({ type: String, nullable: true })
  origin: string | null;
  /** Noms des ingrédients */
  @ApiProperty({ type: [String] })
  ingredients: string[];
  @ApiProperty({ enum: ConsumptionMoment })
  moment: ConsumptionMoment;
  /** Image encodée en base64 */
  @ApiProperty({ type: String, nullable: true })
  image: string | null;
}
