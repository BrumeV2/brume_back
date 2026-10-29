import { ApiProperty } from '@nestjs/swagger';
import { Packaging } from '../enums/packaging.enum';

export class CatalogueFormatDto {
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
  @ApiProperty({ type: 'integer' })
  stock: number;
}
