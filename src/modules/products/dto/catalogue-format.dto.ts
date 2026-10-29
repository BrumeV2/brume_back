import { Packaging } from '../enums/packaging.enum';

export class CatalogueFormatDto {
  id: string;
  packaging: Packaging;
  /** Grammage, en grammes */
  quantity: number;
  /** Prix en centimes */
  price: number;
  stock: number;
}
