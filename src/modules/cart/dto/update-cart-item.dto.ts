import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'Nouvelle quantité absolue de la ligne (entre 1 et 99)',
    example: 3,
    minimum: 1,
    maximum: 99,
  })
  @Type(() => Number)
  @IsInt({ message: 'La quantité doit être un nombre entier.' })
  @Min(1, { message: 'La quantité minimale est de 1.' })
  @Max(99, { message: 'La quantité maximale est de 99.' })
  quantity: number;
}
