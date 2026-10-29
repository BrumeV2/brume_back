import { CaffeineLevel } from '../enums/caffeine-level.enum';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { CatalogueFormatDto } from './catalogue-format.dto';
import { ProductIngredientDto } from './product-ingredient.dto';

export class ProductDetailDto {
  id: string;
  name: string;
  description: string | null;
  typeTea: string | null;
  origin: string | null;
  howMuchCaffeine: CaffeineLevel;
  moment: ConsumptionMoment;
  /** Image encodée en base64 */
  image: string | null;
  /** Ingrédients, la base en premier */
  ingredients: ProductIngredientDto[];
  /** Formats disponibles, du moins cher au plus cher */
  formats: CatalogueFormatDto[];
  createdAt: Date;
  updatedAt: Date;
}
