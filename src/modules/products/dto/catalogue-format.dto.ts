import { Availability } from '../availability/availability';
import { ApiProperty } from '@nestjs/swagger';
import { Packaging } from '../enums/packaging.enum';

export class CatalogueFormatDto {
  @ApiProperty({ enum: Availability })
  availability: Availability;
  @ApiProperty({
    description: 'Commandable pour une unité au moment de la consultation.',
  })
  isOrderable: boolean;
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ enum: Packaging })
  packaging: Packaging;
  /** Grammage, en grammes */
  @ApiProperty({ type: 'integer' })
  quantity: number;
  /** Prix en centimes */
  @ApiProperty({ type: 'integer' })
  price: number;
  @ApiProperty({
    type: 'integer',
    nullable: true,
    description: 'Stock courant, null si la donnée est invalide ou inconnue.',
  })
  stock: number | null;
}
