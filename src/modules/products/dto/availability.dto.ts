import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Availability, MAX_ORDER_QUANTITY } from '../availability/availability';

export class AvailabilityQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_ORDER_QUANTITY,
    default: 1,
    description: 'Nombre d’unités souhaitées, distinct du grammage du format.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_QUANTITY)
  quantity: number = 1;
}

export class FormatAvailabilityDto {
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ format: 'uuid' }) formatId!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: MAX_ORDER_QUANTITY })
  quantity!: number;
  @ApiProperty({ enum: Availability }) availability!: Availability;
  @ApiProperty({
    description:
      'Vrai uniquement si le stock actuel permet toute la quantité demandée. Aucune réservation.',
  })
  isOrderable!: boolean;
}
