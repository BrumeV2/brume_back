import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { AuthConfig } from '../auth/auth.config';
import { readCookie } from '../auth/crypto.util';
import { SessionsService } from '../auth/sessions.service';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { CartValidationResponseDto } from './dto/cart-validation-response.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_COOKIE_NAME = 'brume_cart';
const CART_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours

@ApiTags('cart')
@Public()
@Controller('cart')
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(
    private readonly cartService: CartService,
    private readonly authConfig: AuthConfig,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('items')
  @ApiOperation({
    summary:
      'Ajouter une référence au panier avec validation de prix et disponibilité',
  })
  @ApiBody({
    type: AddCartItemDto,
    examples: {
      format: {
        summary: 'Ajout d un format de thé / infusion (recommandé)',
        value: {
          variantId: '0519ba12-bdf4-4bee-91c7-900c82916d59',
          quantity: 2,
        },
      },
      box: {
        summary: 'Ajout d un coffret (Box)',
        value: {
          boxId: '7efa8bf0-e093-4473-9150-9197566cb8bb',
          quantity: 1,
        },
      },
      giftCard: {
        summary: 'Ajout d une carte cadeau',
        value: {
          giftCard: {
            amount: 5000,
            from: 'Camille',
            to: 'Dominique',
            message: 'Bonne dégustation !',
          },
          quantity: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: CartResponseDto,
    description: 'Article ajouté au panier avec succès.',
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'INVALID_PRICE : prix falsifié ou invalide.',
  })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'PRODUCT_FORMAT_NOT_FOUND : référence introuvable.',
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      'OUT_OF_STOCK : quantité demandée supérieure au stock disponible.',
  })
  async addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartResponseDto> {
    const cartId = await this.resolveCartId(req, res);
    this.logger.log(`Reception POST /cart/items pour la session ${cartId}`);
    return this.cartService.addItem(cartId, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Modifier la quantité d un article dans le panier (US-022)',
  })
  @ApiParam({
    name: 'itemId',
    type: String,
    format: 'uuid',
    description: 'Identifiant de la ligne du panier',
  })
  @ApiBody({
    type: UpdateCartItemDto,
    examples: {
      default: {
        summary: 'Nouvelle quantité souhaitée',
        value: { quantity: 3 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: CartResponseDto,
    description: 'Quantité mise à jour avec succès.',
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'VALIDATION_ERROR : quantité non admise (hors 1-99).',
  })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'NOT_FOUND : ligne introuvable dans ce panier.',
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      'OUT_OF_STOCK : quantité demandée supérieure au stock disponible.',
  })
  async updateItem(
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartResponseDto> {
    const cartId = await this.resolveCartId(req, res);
    this.logger.log(
      `Reception PATCH /cart/items/${itemId} (quantite: ${dto.quantity}) pour la session ${cartId}`,
    );
    return this.cartService.updateItem(cartId, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({
    summary: 'Supprimer une ligne du panier de manière idempotente (US-023)',
  })
  @ApiParam({
    name: 'itemId',
    type: String,
    format: 'uuid',
    description: 'Identifiant de la ligne du panier a supprimer',
  })
  @ApiResponse({
    status: 200,
    type: CartResponseDto,
    description: 'Article retire du panier avec succes.',
  })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'NOT_FOUND : ligne introuvable dans ce panier.',
  })
  async removeItem(
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartResponseDto> {
    const cartId = await this.resolveCartId(req, res);
    this.logger.log(
      `Reception DELETE /cart/items/${itemId} pour la session ${cartId}`,
    );
    return this.cartService.removeItem(cartId, itemId);
  }

  @Post('merge')
  @ApiOperation({
    summary: 'Fusionner le panier visiteur à la connexion (D-017)',
  })
  @ApiResponse({
    status: 200,
    type: CartResponseDto,
    description: 'Panier fusionné avec succès.',
  })
  async merge(
    @Body() dto: MergeCartDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartResponseDto> {
    const cartId = await this.resolveCartId(req, res);
    this.logger.log(
      `Reception POST /cart/merge pour la session ${cartId} (${dto.items?.length ?? 0} article(s))`,
    );
    return this.cartService.merge(cartId, dto.items ?? []);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revalider le panier avant commande (US-025)',
    description:
      'Contrôle références, tarifs, quantités et disponibilité en direct. Génère ou reprend de manière idempotente un contexte de checkout versionné.',
  })
  @ApiResponse({
    status: 200,
    type: CartValidationResponseDto,
    description: 'Résultat de la revalidation du panier.',
  })
  async validateCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartValidationResponseDto> {
    const cartId = await this.resolveCartId(req, res);
    this.logger.log(`Reception POST /cart/validate pour la session ${cartId}`);
    return this.cartService.validateCart(cartId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Mon panier et son total avec précision monétaire explicite (US-024)',
    description:
      'Retourne le panier actif avec recalcul exact des lignes, du sous-total TTC et de la disponibilité.',
  })
  @ApiResponse({
    status: 200,
    type: CartResponseDto,
    description: 'Contenu du panier et totaux calculés avec précision.',
  })
  async getCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartResponseDto> {
    const cartId = await this.resolveCartId(req, res);
    this.logger.log(`Reception GET /cart pour la session ${cartId}`);
    return this.cartService.getCart(cartId);
  }

  private async resolveCartId(req: Request, res: Response): Promise<string> {
    const sessionToken = readCookie(req.headers.cookie, 'brume_session');
    if (sessionToken) {
      try {
        const session = await this.sessionsService.authenticate(sessionToken);
        if (session?.user?.id) {
          const userCartId = `user:${session.user.id}`;
          res.setHeader('X-Cart-Id', userCartId);
          return userCartId;
        }
      } catch {
        // En cas de session invalide/expiree, repli sur le cookie de panier
      }
    }

    const existingFromCookie = readCookie(req.headers.cookie, CART_COOKIE_NAME);
    const existingFromHeader = req.headers['x-cart-id'];
    const resolvedCartId =
      existingFromCookie ||
      (typeof existingFromHeader === 'string' &&
      existingFromHeader.trim().length > 0
        ? existingFromHeader.trim()
        : randomUUID());

    res.setHeader('X-Cart-Id', resolvedCartId);

    if (!existingFromCookie || existingFromCookie !== resolvedCartId) {
      res.cookie(CART_COOKIE_NAME, resolvedCartId, {
        httpOnly: true,
        secure: this.authConfig.secure,
        sameSite: 'lax',
        path: '/',
        maxAge: CART_COOKIE_MAX_AGE,
      });
    }

    return resolvedCartId;
  }
}
