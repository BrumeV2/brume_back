import { IngredientType } from '../enums/ingredient-type.enum';

export class ProductIngredientDto {
  id: string;
  name: string;
  description: string | null;
  type: IngredientType;
}
