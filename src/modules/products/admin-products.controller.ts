import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { AdminProductsService } from './admin-products.service';
import { AdminProductDto } from './dto/admin-product.dto';
import { CreateProductDto } from './dto/create-product.dto';

// TODO(admin) : restreindre au rôle ADMIN dès que la garde de rôle sera livrée.
// En attente, la route exige seulement une session valide (garde globale).
@ApiTags('admin-catalog')
@ApiCookieAuth('sessionCookie')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminProducts: AdminProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'Créer un produit avec ses formats (US-080)',
    description:
      'Création atomique : produit, formats et ingrédients sont enregistrés ensemble ou pas du tout. Brouillon par défaut.',
  })
  // Origin n'est pas déclaré : le navigateur l'envoie seul et Swagger UI ne peut pas le fixer.
  // Il doit figurer dans CORS_ORIGIN (garde CSRF globale).
  @ApiHeader({
    name: 'X-CSRF-Protection',
    required: true,
    schema: { type: 'string', enum: ['1'] },
  })
  @ApiCreatedResponse({ type: AdminProductDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'VALIDATION_ERROR : champ invalide ou ingrédient introuvable.',
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: 'UNAUTHENTICATED',
  })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'FORBIDDEN' })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      'VALIDATION_ERROR : référence de format déjà utilisée (details[].field = formats.{index}.sku).',
  })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProductDto) {
    return this.adminProducts.create(dto, userId);
  }
}
