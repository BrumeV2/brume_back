import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogueQueryDto } from './dto/catalogue-query.dto';
import { CatalogueFiltersDto } from './dto/catalogue-filters.dto';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { CataloguePageDto } from './dto/catalogue-page.dto';
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
}
