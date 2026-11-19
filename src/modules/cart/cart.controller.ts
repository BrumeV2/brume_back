import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { AuthConfig } from '../auth/auth.config';
import { readCookie } from '../auth/crypto.util';
import { SessionsService } from '../auth/sessions.service';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
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

  @Get()
  @ApiOperation({
    summary: 'Consulter le panier actuel (session en cache)',
  })
  @ApiResponse({
    status: 200,
    type: CartResponseDto,
    description: 'Contenu du panier.',
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
