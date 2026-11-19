import { ApiProperty } from '@nestjs/swagger';
import { IngredientType } from '../enums/ingredient-type.enum';

export class IngredientListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty({ enum: IngredientType })
  type: IngredientType;
  @ApiProperty({
    type: [String],
    description: 'Synonymes reconnus par les recherches.',
  })
  aliases: string[];
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Nombre de produits publiés qui contiennent l’ingrédient. 0 : le filtre renverra une liste vide.',
  })
  productCount: number;
}
