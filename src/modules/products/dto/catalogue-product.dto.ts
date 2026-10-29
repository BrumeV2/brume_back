import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { CatalogueFormatDto } from './catalogue-format.dto';

export class CatalogueProductDto {
  id: string;
  name: string;
  typeTea: string | null;
  origin: string | null;
  /** Noms des ingrédients */
  ingredients: string[];
  /** Prix du format le moins cher (« à partir de »), en centimes */
  price: number;
  moment: ConsumptionMoment;
  /** Image encodée en base64 */
  image: string | null;
  /** Formats disponibles, du moins cher au plus cher */
  formats: CatalogueFormatDto[];
}
