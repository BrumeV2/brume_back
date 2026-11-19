import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { IngredientListItemDto } from './dto/ingredient-list-item.dto';
import { IngredientsQueryDto } from './dto/ingredients-query.dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('products')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Public()
  @Get()
  @ApiOkResponse({
    type: IngredientListItemDto,
    isArray: true,
    description:
      'Référentiel complet trié par nom puis UUID, y compris les ingrédients sans produit publié.',
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description:
      'Recherche invalide (q vide, trop courte, trop longue ou répétée).',
  })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'STOCK_UNAVAILABLE',
  })
  findAll(@Query() query: IngredientsQueryDto) {
    return this.ingredientsService.findAll(query);
  }
}
