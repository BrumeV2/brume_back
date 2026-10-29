import { PaginationMetaDto } from '../../../common/dto/paginated-response.dto';
import { CatalogueProductDto } from './catalogue-product.dto';

// Classe concrète pour que Swagger connaisse le type des éléments de `data`
export class CataloguePageDto {
  data: CatalogueProductDto[];
  meta: PaginationMetaDto;
}
