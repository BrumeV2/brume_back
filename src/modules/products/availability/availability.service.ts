import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { ProductFormat } from '../entities/product-format.entity';
import { FormatAvailabilityDto } from '../dto/availability.dto';
import {
  Availability,
  availabilityOf,
  MAX_ORDER_QUANTITY,
  readStock,
  stockUnavailable,
} from './availability';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(ProductFormat)
    private readonly formats: Repository<ProductFormat>,
  ) {}

  private async read(
    productId: string,
    formatId: string,
    quantity: number,
    manager?: EntityManager,
  ) {
    // Also validate internal callers; future basket writes must not bypass HTTP validation.
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ORDER_QUANTITY
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La quantité doit être un entier entre 1 et 99.',
        details: [{ field: 'quantity', constraints: ['quantityRange'] }],
      });
    }
    const format = await readStock(() =>
      (manager?.getRepository(ProductFormat) ?? this.formats).findOne({
        where: { id: formatId, product: { id: productId } },
        relations: { product: true },
      }),
    );
    if (!format) throw new NotFoundException();
    const availability = availabilityOf(format.stock);
    if (availability === Availability.UNKNOWN) throw stockUnavailable();
    return { format, availability };
  }

  async check(
    productId: string,
    formatId: string,
    quantity = 1,
  ): Promise<FormatAvailabilityDto> {
    const { format, availability } = await this.read(
      productId,
      formatId,
      quantity,
    );
    return {
      productId,
      formatId,
      quantity,
      availability,
      isOrderable: format.stock >= quantity,
    };
  }

  // Relit impérativement le stock. À appeler lors de chaque ajout/modification de panier.
  // Le manager permet une utilisation dans la transaction du futur appelant.
  // Ne réserve ni ne décrémente le stock : le checkout doit contrôler/réserver atomiquement.
  async assertOrderable(
    productId: string,
    formatId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<ProductFormat> {
    const { format } = await this.read(productId, formatId, quantity, manager);
    if (format.stock < quantity)
      throw new ConflictException({
        code: 'OUT_OF_STOCK',
        message: 'La quantité demandée n’est plus disponible pour ce format.',
      });
    return format;
  }
}
