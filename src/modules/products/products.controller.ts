import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { CatalogueFiltersDto } from './dto/catalogue-filters.dto';
import { CatalogueQueryDto } from './dto/catalogue-query.dto';
import { CataloguePageDto } from './dto/catalogue-page.dto';
import { CatalogueProductDto } from './dto/catalogue-product.dto';
import { ProductDetailDto } from './dto/product-detail.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'Paramètre ou valeur de filtre invalide.',
  })
  @ApiOkResponse({ type: CataloguePageDto })
  findCatalogue(@Query() query: CatalogueQueryDto) {
    return this.productsService.findCatalogue(query);
  }

  @Public()
  @Get('filters')
  @ApiOkResponse({
    type: CatalogueFiltersDto,
    description:
      'Choix présents dans le catalogue complet, indépendants des filtres sélectionnés.',
  })
  filters() {
    return this.productsService.filters();
  }

  @Public()
  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.findOne(id);
  }

  // « Dans le même esprit » : les 3 produits les plus proches, en stock
  @Public()
  @Get(':id/similar')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CatalogueProductDto, isArray: true })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  findSimilar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.findSimilar(id);
  }
}
