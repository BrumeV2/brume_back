import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CartResponseDto, CartWarningDto } from './cart-response.dto';

export class CartDiscrepancyDto {
  @ApiProperty({
    description: 'Type d écart constaté lors de la revalidation',
    enum: ['price', 'quantity', 'removed', 'warning'],
    example: 'price',
  })
  kind: 'price' | 'quantity' | 'removed' | 'warning';

  @ApiProperty({
    description: 'Message explicatif lisible par l utilisateur',
    example: 'Le prix de Matcha cérémonie est passé de 24 € à 26 €.',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Ancien prix en centimes (si écart de prix)',
    example: 2400,
  })
  previousPriceCents?: number;

  @ApiPropertyOptional({
    description: 'Nouveau prix en centimes (si écart de prix)',
    example: 2600,
  })
  newPriceCents?: number;

  @ApiPropertyOptional({
    description: 'Identifiant de la variante ou du SKU concerné',
    example: 'MAT-50G',
  })
  sku?: string;
}

export class CartValidationResponseDto {
  @ApiProperty({
    description:
      'Indique si le panier est immédiatement validable pour commande',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Statut de validation du panier',
    enum: ['valid', 'empty', 'changed', 'blocked'],
    example: 'valid',
  })
  status: 'valid' | 'empty' | 'changed' | 'blocked';

  @ApiPropertyOptional({
    description:
      'Identifiant unique du contexte de checkout versionné (si valid ou changed)',
    example: 'e0123456-789a-bcde-f012-3456789abcde',
  })
  checkoutContextId?: string;

  @ApiPropertyOptional({
    description: 'Numéro de version du contexte de checkout',
    example: 1,
  })
  version?: number;

  @ApiProperty({
    type: CartResponseDto,
    description: 'État actuel du panier après revalidation',
  })
  cart: CartResponseDto;

  @ApiProperty({
    type: [CartDiscrepancyDto],
    description: 'Liste des écarts constatés lors de la revalidation',
  })
  discrepancies: CartDiscrepancyDto[];

  @ApiProperty({
    type: [CartWarningDto],
    description: 'Avertissements de stock ou d indisponibilité',
  })
  warnings: CartWarningDto[];
}
