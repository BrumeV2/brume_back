import { ApiProperty } from '@nestjs/swagger';
import { CartItemResponseDto } from './cart-item-response.dto';

export class CartWarningDto {
  @ApiProperty({
    description: 'Code d avertissement',
    enum: ['OUT_OF_STOCK', 'QUANTITY_REDUCED', 'PRODUCT_UNAVAILABLE'],
    example: 'OUT_OF_STOCK',
  })
  code: 'OUT_OF_STOCK' | 'QUANTITY_REDUCED' | 'PRODUCT_UNAVAILABLE';

  @ApiProperty({
    description: 'SKU concerné',
    example: 'EG-100G',
  })
  sku: string;

  @ApiProperty({
    description: 'Message explicatif',
    example: 'Stock insuffisant pour 1 article.',
  })
  message?: string;
}

export class CartResponseDto {
  @ApiProperty({
    description: 'Identifiant unique du panier',
    example: 'c2eedd77-7a0b-4de6-995b-4aa7ab160c33',
  })
  id: string;

  @ApiProperty({
    type: [CartItemResponseDto],
    description: 'Lignes d articles du panier',
  })
  items: CartItemResponseDto[];

  @ApiProperty({
    description: 'Nombre total d articles dans le panier',
    example: 3,
  })
  itemsCount: number;

  @ApiProperty({
    description: 'Sous-total articles TTC en centimes (hors livraison)',
    example: 4070,
  })
  itemsTotalCents: number;

  @ApiProperty({
    description:
      'Indique si le panier contient au moins un produit réservé aux majeurs (CBD)',
    example: false,
  })
  ageRestricted: boolean;

  @ApiProperty({
    type: [CartWarningDto],
    description: 'Alertes ou écarts détectés sur le panier',
  })
  warnings: CartWarningDto[];

  @ApiProperty({
    description: 'Date de dernière modification au format ISO',
    example: '2026-11-19T10:00:00.000Z',
  })
  updatedAt: string;
}
