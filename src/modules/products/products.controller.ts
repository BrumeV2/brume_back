import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CataloguePageDto } from './dto/catalogue-page.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: CataloguePageDto })
  findCatalogue(@Query() query: PaginationQueryDto) {
    return this.productsService.findCatalogue(query);
  }
}
