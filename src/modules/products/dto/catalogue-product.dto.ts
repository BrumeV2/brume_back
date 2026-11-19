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
  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Prix du format le moins cher, en centimes. null si aucun format.',
  })
  lowestPrice: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Note moyenne des avis, sur 5, arrondie à une décimale. null si aucune note.',
  })
  averageRating: number | null;
  @ApiProperty({ type: 'integer', description: 'Nombre d’avis notés.' })
  ratingCount: number;
}
