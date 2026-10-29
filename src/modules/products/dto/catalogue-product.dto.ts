import { ConsumptionMoment } from '../enums/consumption-moment.enum';

export class CatalogueProductDto {
  id: string;
  name: string;
  typeTea: string | null;
  origin: string | null;
  /** Noms des ingrédients */
  ingredients: string[];
  /** Prix en centimes */
  price: number;
  moment: ConsumptionMoment;
  /** Image encodée en base64 */
  image: string | null;
}
