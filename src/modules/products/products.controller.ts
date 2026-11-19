import { AvailabilityService } from './availability/availability.service';
import {
  AvailabilityQueryDto,
  FormatAvailabilityDto,
} from './dto/availability.dto';
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
  constructor(
    private readonly productsService: ProductsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Public()
  @Get()
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description:
      'Paramètre, recherche ou valeur de filtre invalide (q vide, trop courte ou répétée…).',
  })
  @ApiOkResponse({ type: CataloguePageDto })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'STOCK_UNAVAILABLE',
  })
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
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'STOCK_UNAVAILABLE',
  })
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
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'STOCK_UNAVAILABLE',
  })
  findSimilar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.findSimilar(id);
  }
  @Public()
  @Get(':id/formats/:formatId/availability')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'formatId', format: 'uuid' })
  @ApiOkResponse({ type: FormatAvailabilityDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'STOCK_UNAVAILABLE : aucun accord de commandabilité possible.',
  })
  checkAvailability(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('formatId', new ParseUUIDPipe({ version: '4' })) formatId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availability.check(id, formatId, query.quantity);
  }
}
