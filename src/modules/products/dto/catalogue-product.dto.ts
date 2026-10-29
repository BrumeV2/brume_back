import { ConsumptionMoment } from '../enums/consumption-moment.enum';

export class CatalogueProductDto {
  id: string;
  name: string;
  typeTea: string | null;
  origin: string | null;
  /** Noms des ingrédients */
  ingredients: string[];
  moment: ConsumptionMoment;
  /** Image encodée en base64 */
  image: string | null;
}
