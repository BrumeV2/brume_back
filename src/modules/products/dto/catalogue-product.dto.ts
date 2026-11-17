import { ApiProperty } from '@nestjs/swagger';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { CatalogueFormatDto } from './catalogue-format.dto';

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
  /** Prix du format le moins cher (« à partir de »), en centimes */
  @ApiProperty({ type: 'integer' })
  price: number;
  @ApiProperty({ enum: ConsumptionMoment })
  moment: ConsumptionMoment;
  /** Image encodée en base64 */
  @ApiProperty({ type: String, nullable: true })
  image: string | null;
  /** Formats disponibles, du moins cher au plus cher */
  @ApiProperty({ type: [CatalogueFormatDto] })
  formats: CatalogueFormatDto[];
}
