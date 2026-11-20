import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GiftCardInputDto {
  @ApiProperty({
    description: 'Montant de la carte cadeau en centimes',
    example: 5000,
    minimum: 500,
    maximum: 100000,
  })
  @IsInt()
  @Min(500)
  @Max(100000)
  amount: number;

  @ApiPropertyOptional({
    description: 'Nom ou e-mail de l expéditeur',
    example: 'Camille',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  from?: string;

  @ApiPropertyOptional({
    description: 'Nom ou e-mail du destinataire',
    example: 'Dominique',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  to?: string;

  @ApiPropertyOptional({
    description: 'Message personnalisé accompagnant la carte',
    example: 'Bonne dégustation !',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class AddCartItemDto {
  @ApiPropertyOptional({
    description: 'Type d article (optionnel : format, box, gift_card)',
    example: 'format',
  })
  @IsOptional()
  @IsString()
  itemType?: string;

  @ApiPropertyOptional({
    description:
      'Identifiant UUID de la référence/format de produit (thé/infusion)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID()
  formatId?: string;

  @ApiPropertyOptional({
    description: 'Alias frontend compatible pour formatId',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({
    description: 'Identifiant UUID d un coffret (Box)',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsOptional()
  @IsUUID()
  boxId?: string;

  @ApiPropertyOptional({
    description: 'Détails d une carte cadeau personnalisée',
    type: GiftCardInputDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GiftCardInputDto)
  giftCard?: GiftCardInputDto;

  @ApiProperty({
    description: 'Quantité souhaitée à ajouter',
    minimum: 1,
    maximum: 99,
    default: 1,
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number = 1;

  @ApiPropertyOptional({
    description:
      'Prix unitaire en centimes affiché côté client. Permet de vérifier l absence de falsification.',
    example: 1200,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Alias pour unitPrice en centimes',
    example: 1200,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceCents?: number;
}
