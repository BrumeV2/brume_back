import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Box } from '../products/entities/box.entity';
import { ProductFormat } from '../products/entities/product-format.entity';
import { Packaging } from '../products/enums/packaging.enum';
import { CartCacheService } from './cart-cache.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItemResponseDto } from './dto/cart-item-response.dto';
import { CartResponseDto, CartWarningDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import type {
  CartCache,
  CartLineCache,
} from './interfaces/cart-cache.interface';

const DEFAULT_CART_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(ProductFormat)
    private readonly formatRepo: Repository<ProductFormat>,
    @InjectRepository(Box)
    private readonly boxRepo: Repository<Box>,
    private readonly cartCache: CartCacheService,
  ) {}

  getOrCreateCart(cartId: string): CartCache {
    const existing = this.cartCache.get(cartId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newCart: CartCache = {
      id: cartId,
      items: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: Date.now() + DEFAULT_CART_TTL_MS,
    };
    this.cartCache.set(newCart);
    return newCart;
  }

  async addItem(cartId: string, dto: AddCartItemDto): Promise<CartResponseDto> {
    const formatTargetId = dto.formatId ?? dto.variantId;
    const targetsCount = [
      Boolean(formatTargetId),
      Boolean(dto.boxId),
      Boolean(dto.giftCard),
    ].filter(Boolean).length;

    if (targetsCount === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Vous devez spécifier une variante, un coffret ou une carte cadeau.',
      });
    }

    if (targetsCount > 1) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Spécifiez un seul type d article par ajout (variante, box ou carte cadeau).',
      });
    }

    if (formatTargetId) {
      return this.addFormatItem(
        cartId,
        formatTargetId,
        dto.quantity,
        dto.unitPrice,
      );
    }

    if (dto.boxId) {
      return this.addBoxItem(cartId, dto.boxId, dto.quantity, dto.unitPrice);
    }

    return this.addGiftCardItem(
      cartId,
      dto.giftCard!,
      dto.quantity,
      dto.unitPrice,
    );
  }

  async getCart(cartId: string): Promise<CartResponseDto> {
    const cart = this.getOrCreateCart(cartId);
    this.logger.debug(
      `Consultation du panier ${cartId} (${cart.items.length} article(s))`,
    );
    return this.buildCartResponse(cart);
  }

  async updateItem(
    cartId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const cart = this.getOrCreateCart(cartId);
    const item = cart.items.find((line) => line.id === itemId);

    if (!item) {
      this.logger.warn(
        `Ligne introuvable ou non autorisee sur le panier ${cartId} : ${itemId}`,
      );
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Ligne de panier introuvable.',
      });
    }

    if (item.itemType === 'format') {
      const format = await this.formatRepo.findOne({
        where: { id: item.formatId },
        relations: { product: true },
      });

      if (!format) {
        throw new NotFoundException({
          code: 'PRODUCT_FORMAT_NOT_FOUND',
          message: 'Variante de produit introuvable.',
        });
      }

      if (dto.quantity > format.stock) {
        const sku =
          format.product?.typeTea && format.quantity
            ? `${format.product.typeTea.substring(0, 3).toUpperCase()}-${format.quantity}G`
            : format.id;

        this.logger.warn(
          `Stock insuffisant lors de la modification de la ligne ${itemId} sur le panier ${cartId} : demande=${dto.quantity}, disponible=${format.stock}`,
        );
        throw new ConflictException({
          code: 'OUT_OF_STOCK',
          message: 'Stock insuffisant pour 1 article.',
          details: [
            {
              variantId: format.id,
              sku,
              requested: dto.quantity,
              available: format.stock,
            },
          ],
        });
      }

      item.unitPrice = format.price;
    } else if (item.itemType === 'box') {
      const box = await this.boxRepo.findOne({
        where: { id: item.boxId },
      });

      if (!box) {
        throw new NotFoundException({
          code: 'BOX_NOT_FOUND',
          message: 'Coffret introuvable.',
        });
      }

      item.unitPrice = box.price;
    }

    const now = new Date().toISOString();
    item.quantity = dto.quantity;
    item.updatedAt = now;
    cart.updatedAt = now;
    this.cartCache.set(cart);

    this.logger.log(
      `Quantite mise a jour pour la ligne ${itemId} sur le panier ${cartId} : ${dto.quantity}`,
    );

    return this.buildCartResponse(cart);
  }

  async merge(
    cartId: string,
    itemsToMerge: AddCartItemDto[],
  ): Promise<CartResponseDto> {
    const cart = this.getOrCreateCart(cartId);
    const warnings: CartWarningDto[] = [];

    for (const item of itemsToMerge) {
      const formatId = item.formatId ?? item.variantId;
      if (!formatId) {
        continue;
      }

      const format = await this.formatRepo.findOne({
        where: { id: formatId },
        relations: { product: true },
      });

      if (!format) {
        warnings.push({
          code: 'PRODUCT_UNAVAILABLE',
          sku: formatId,
          message: 'Produit retiré du catalogue.',
        });
        continue;
      }

      const sku =
        format.product?.typeTea && format.quantity
          ? `${format.product.typeTea.substring(0, 3).toUpperCase()}-${format.quantity}G`
          : format.id;

      if (format.stock <= 0) {
        warnings.push({
          code: 'OUT_OF_STOCK',
          sku,
          message: 'Variante épuisée.',
        });
        continue;
      }

      const existingItem = cart.items.find(
        (line) => line.itemType === 'format' && line.formatId === format.id,
      );
      const currentQty = existingItem ? existingItem.quantity : 0;
      let targetQty = currentQty + item.quantity;

      if (targetQty > format.stock) {
        targetQty = format.stock;
        warnings.push({
          code: 'QUANTITY_REDUCED',
          sku,
          message: `Quantité plafonnée au stock disponible (${format.stock}).`,
        });
      }

      const now = new Date().toISOString();
      if (existingItem) {
        existingItem.quantity = targetQty;
        existingItem.unitPrice = format.price;
        existingItem.updatedAt = now;
      } else {
        cart.items.push({
          id: randomUUID(),
          itemType: 'format',
          formatId: format.id,
          quantity: targetQty,
          unitPrice: format.price,
          addedAt: now,
          updatedAt: now,
        });
      }
    }

    cart.updatedAt = new Date().toISOString();
    this.cartCache.set(cart);
    return this.buildCartResponse(cart, warnings);
  }

  private async addFormatItem(
    cartId: string,
    formatId: string,
    quantity: number,
    expectedPrice?: number,
  ): Promise<CartResponseDto> {
    const format = await this.formatRepo.findOne({
      where: { id: formatId },
      relations: { product: true },
    });

    if (!format) {
      this.logger.warn(
        `Format introuvable lors de l ajout au panier ${cartId} : ${formatId}`,
      );
      throw new NotFoundException({
        code: 'PRODUCT_FORMAT_NOT_FOUND',
        message: 'Variante de produit introuvable.',
      });
    }

    // Contrôle serveur anti-falsification du prix
    if (expectedPrice !== undefined && expectedPrice !== format.price) {
      this.logger.warn(
        `Prix falsifie detecte sur le panier ${cartId} pour le format ${format.id} : attendu=${format.price}, recu=${expectedPrice}`,
      );
      throw new BadRequestException({
        code: 'INVALID_PRICE',
        message: 'Le prix unitaire ne correspond pas à la référence.',
      });
    }

    const cart = this.getOrCreateCart(cartId);
    const existingItem = cart.items.find(
      (item) => item.itemType === 'format' && item.formatId === format.id,
    );
    const currentQty = existingItem ? existingItem.quantity : 0;
    const targetQty = currentQty + quantity;

    if (targetQty > format.stock) {
      this.logger.warn(
        `Stock insuffisant sur le panier ${cartId} pour le format ${format.id} : demande=${targetQty}, disponible=${format.stock}`,
      );
      throw new ConflictException({
        code: 'OUT_OF_STOCK',
        message: `Stock insuffisant : ${format.stock} disponible(s), ${targetQty} demandé(s).`,
      });
    }

    const now = new Date().toISOString();

    if (existingItem) {
      existingItem.quantity = targetQty;
      existingItem.unitPrice = format.price;
      existingItem.updatedAt = now;
    } else {
      const newLine: CartLineCache = {
        id: randomUUID(),
        itemType: 'format',
        formatId: format.id,
        quantity: targetQty,
        unitPrice: format.price,
        addedAt: now,
        updatedAt: now,
      };
      cart.items.push(newLine);
    }

    cart.updatedAt = now;
    this.cartCache.set(cart);
    this.logger.log(
      `Format ${format.id} ajoute au panier ${cartId} (quantite: ${targetQty}, prix unitaire: ${format.price} centimes)`,
    );

    return this.buildCartResponse(cart);
  }

  private async addBoxItem(
    cartId: string,
    boxId: string,
    quantity: number,
    expectedPrice?: number,
  ): Promise<CartResponseDto> {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
    });

    if (!box) {
      this.logger.warn(
        `Coffret introuvable lors de l ajout au panier ${cartId} : ${boxId}`,
      );
      throw new NotFoundException({
        code: 'BOX_NOT_FOUND',
        message: 'Coffret introuvable.',
      });
    }

    // Contrôle serveur anti-falsification du prix du coffret
    if (expectedPrice !== undefined && expectedPrice !== box.price) {
      this.logger.warn(
        `Prix falsifie detecte sur le panier ${cartId} pour le coffret ${box.id} : attendu=${box.price}, recu=${expectedPrice}`,
      );
      throw new BadRequestException({
        code: 'INVALID_PRICE',
        message: 'Le prix unitaire ne correspond pas au tarif du coffret.',
      });
    }

    const cart = this.getOrCreateCart(cartId);
    const existingItem = cart.items.find(
      (item) => item.itemType === 'box' && item.boxId === box.id,
    );
    const currentQty = existingItem ? existingItem.quantity : 0;
    const targetQty = currentQty + quantity;

    if (targetQty > 99) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La quantité totale par article ne peut pas dépasser 99.',
      });
    }

    const now = new Date().toISOString();

    if (existingItem) {
      existingItem.quantity = targetQty;
      existingItem.unitPrice = box.price;
      existingItem.updatedAt = now;
    } else {
      const newLine: CartLineCache = {
        id: randomUUID(),
        itemType: 'box',
        boxId: box.id,
        quantity: targetQty,
        unitPrice: box.price,
        addedAt: now,
        updatedAt: now,
      };
      cart.items.push(newLine);
    }

    cart.updatedAt = now;
    this.cartCache.set(cart);
    this.logger.log(
      `Coffret ${box.id} ajoute au panier ${cartId} (quantite: ${targetQty}, prix unitaire: ${box.price} centimes)`,
    );

    return this.buildCartResponse(cart);
  }

  private async addGiftCardItem(
    cartId: string,
    giftCardInput: {
      amount: number;
      from?: string;
      to?: string;
      message?: string;
    },
    quantity: number,
    expectedPrice?: number,
  ): Promise<CartResponseDto> {
    if (expectedPrice !== undefined && expectedPrice !== giftCardInput.amount) {
      this.logger.warn(
        `Prix falsifie detecte sur le panier ${cartId} pour la carte cadeau : attendu=${giftCardInput.amount}, recu=${expectedPrice}`,
      );
      throw new BadRequestException({
        code: 'INVALID_PRICE',
        message:
          'Le prix unitaire ne correspond pas au montant de la carte cadeau.',
      });
    }

    const cart = this.getOrCreateCart(cartId);
    const now = new Date().toISOString();

    const newLine: CartLineCache = {
      id: randomUUID(),
      itemType: 'gift_card',
      giftCard: {
        id: randomUUID(),
        amount: giftCardInput.amount,
        from: giftCardInput.from,
        to: giftCardInput.to,
        message: giftCardInput.message,
      },
      quantity,
      unitPrice: giftCardInput.amount,
      addedAt: now,
      updatedAt: now,
    };

    cart.items.push(newLine);
    cart.updatedAt = now;
    this.cartCache.set(cart);
    this.logger.log(
      `Carte cadeau de ${giftCardInput.amount} centimes ajoutee au panier ${cartId}`,
    );

    return this.buildCartResponse(cart);
  }

  private async buildCartResponse(
    cart: CartCache,
    extraWarnings: CartWarningDto[] = [],
  ): Promise<CartResponseDto> {
    const formatIds = cart.items
      .filter((i) => i.itemType === 'format' && i.formatId)
      .map((i) => i.formatId as string);

    const boxIds = cart.items
      .filter((i) => i.itemType === 'box' && i.boxId)
      .map((i) => i.boxId as string);

    let formatsMap = new Map<string, ProductFormat>();
    if (formatIds.length > 0) {
      const formats = await this.formatRepo.find({
        where: { id: In(formatIds) },
        relations: { product: true },
      });
      formatsMap = new Map(formats.map((f) => [f.id, f]));
    }

    let boxesMap = new Map<string, Box>();
    if (boxIds.length > 0) {
      const boxes = await this.boxRepo.find({
        where: { id: In(boxIds) },
      });
      boxesMap = new Map(boxes.map((b) => [b.id, b]));
    }

    let itemsTotalCents = 0;
    let itemsCount = 0;
    const warnings: CartWarningDto[] = [];

    const items: CartItemResponseDto[] = cart.items.map((item) => {
      const lineTotalCents = item.quantity * item.unitPrice;
      itemsTotalCents += lineTotalCents;
      itemsCount += item.quantity;

      if (item.itemType === 'format' && item.formatId) {
        const format = formatsMap.get(item.formatId);
        const productName = format?.product?.name ?? 'Thé Brume';
        const packagingLabel =
          format?.packaging === Packaging.BAG
            ? 'Sachet'
            : format?.packaging === Packaging.BOX
              ? 'Boîte'
              : 'Boîte métal';
        const variantLabel = format
          ? `${format.quantity} g · ${packagingLabel}`
          : 'Format inconnu';
        const sku = format
          ? `PF-${format.packaging.toUpperCase()}-${format.quantity}G`
          : 'PF-UNKNOWN';

        const isOutOfStock = format ? item.quantity > format.stock : true;
        if (isOutOfStock) {
          warnings.push({
            code: 'OUT_OF_STOCK',
            sku,
            message: `Stock insuffisant pour ${productName}.`,
          });
        }

        return {
          id: item.id,
          itemType: 'format',
          variantId: item.formatId,
          formatId: item.formatId,
          sku,
          productName,
          productSlug: slugify(productName),
          variantLabel,
          imageUrl: format?.product?.image ?? null,
          unitPriceCents: item.unitPrice,
          quantity: item.quantity,
          lineTotalCents,
          availability: isOutOfStock ? 'OUT_OF_STOCK' : 'IN_STOCK',
          ageRestricted: false,
        };
      }

      if (item.itemType === 'box' && item.boxId) {
        const box = boxesMap.get(item.boxId);
        const productName = box?.name ?? 'Coffret Brume';
        const sku = `BOX-${slugify(productName).toUpperCase()}`;

        return {
          id: item.id,
          itemType: 'box',
          boxId: item.boxId,
          sku,
          productName,
          productSlug: slugify(productName),
          variantLabel: 'Coffret assortiment',
          imageUrl: null,
          unitPriceCents: item.unitPrice,
          quantity: item.quantity,
          lineTotalCents,
          availability: 'IN_STOCK',
          ageRestricted: false,
        };
      }

      // Carte cadeau
      const amountEuros = Math.round(item.unitPrice / 100);
      const productName = 'Carte Cadeau Brume';
      const variantLabel = `Carte cadeau ${amountEuros} €`;
      const sku = `GIFTCARD-${amountEuros}E`;

      return {
        id: item.id,
        itemType: 'gift_card',
        giftCard: item.giftCard,
        sku,
        productName,
        productSlug: 'carte-cadeau',
        variantLabel,
        imageUrl: null,
        unitPriceCents: item.unitPrice,
        quantity: item.quantity,
        lineTotalCents,
        availability: 'IN_STOCK',
        ageRestricted: false,
      };
    });

    return {
      id: cart.id,
      items,
      itemsCount,
      itemsTotalCents,
      ageRestricted: false,
      warnings: [...warnings, ...extraWarnings],
      updatedAt: cart.updatedAt,
    };
  }
}
