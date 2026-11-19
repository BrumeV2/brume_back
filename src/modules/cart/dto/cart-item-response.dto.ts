import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CartGiftCardData,
  CartItemType,
} from '../interfaces/cart-cache.interface';

export class CartItemResponseDto {
  @ApiProperty({
    description: 'Identifiant unique de la ligne de panier',
    example: 'b1ffcd88-8b0a-4fe7-aa5c-5aa8ac270b22',
  })
  id: string;

  @ApiProperty({
    description: 'Type d article : format de produit, box ou carte cadeau',
    enum: ['format', 'box', 'gift_card'],
    example: 'format',
  })
  itemType: CartItemType;

  @ApiPropertyOptional({
    description: 'Identifiant de la variante (ProductFormat)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  variantId?: string;

  @ApiPropertyOptional({
    description: 'Alias pour variantId',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  formatId?: string;

  @ApiPropertyOptional({
    description: 'Identifiant du coffret (Box)',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  boxId?: string;

  @ApiPropertyOptional({
    description: 'Détails de la carte cadeau (si type = gift_card)',
  })
  giftCard?: CartGiftCardData;

  @ApiProperty({
    description: 'Code SKU de l article',
    example: 'EG-100G',
  })
  sku: string;

  @ApiProperty({
    description: 'Nom de l article',
    example: 'Earl Grey Impérial',
  })
  productName: string;

  @ApiProperty({
    description: 'Slug de l article',
    example: 'earl-grey-imperial',
  })
  productSlug: string;

  @ApiProperty({
    description: 'Libellé de la déclinaison / conditionnement',
    example: '100 g',
  })
  variantLabel: string;

  @ApiPropertyOptional({
    description: 'Image de présentation',
    nullable: true,
  })
  imageUrl?: string | null;

  @ApiProperty({
    description: 'Prix unitaire TTC en centimes',
    example: 1290,
  })
  unitPriceCents: number;

  @ApiProperty({
    description: 'Quantité sélectionnée',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description:
      'Montant total de la ligne en centimes (quantité * prix unitaire)',
    example: 2580,
  })
  lineTotalCents: number;

  @ApiProperty({
    description: 'Disponibilité de l article',
    example: 'IN_STOCK',
  })
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

  @ApiProperty({
    description: 'Indique si l article est soumis à restriction d âge',
    example: false,
  })
  ageRestricted: boolean;
}
