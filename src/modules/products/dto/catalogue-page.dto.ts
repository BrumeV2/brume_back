import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/paginated-response.dto';
import { CatalogueProductDto } from './catalogue-product.dto';

// Classe concrète pour que Swagger connaisse le type des éléments de `data`
export class CataloguePageDto {
  @ApiProperty({ type: [CatalogueProductDto] })
  data: CatalogueProductDto[];
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
