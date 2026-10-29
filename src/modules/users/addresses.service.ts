import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { User } from './entities/user.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { authenticationFailed } from './users.service';

function publicAddress(address: Address) {
  const {
    id,
    firstName,
    lastName,
    line1,
    line2,
    postalCode,
    city,
    country,
    phone,
    label,
    isDefault,
    createdAt,
    updatedAt,
  } = address;
  return {
    id,
    firstName,
    lastName,
    line1,
    line2,
    postalCode,
    city,
    country,
    phone,
    label,
    isDefault,
    createdAt,
    updatedAt,
  };
}

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address) private readonly addresses: Repository<Address>,
    private readonly db: DataSource,
  ) {}

  async list(userId: string) {
    const addresses = await this.addresses.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC', id: 'ASC' },
    });
    return addresses.map(publicAddress);
  }

  private zone(country: string, postalCode: string) {
    if (
      country !== 'FR' ||
      !/^(?!20)(?:0[1-9]|[1-8][0-9]|9[0-5])\d{3}$/.test(postalCode)
    ) {
      throw new UnprocessableEntityException({
        code: 'SHIPPING_ZONE_NOT_SERVED',
        message:
          'Adresse hors de la zone de livraison : France métropolitaine continentale uniquement.',
      });
    }
  }

  private async lockUser(manager: EntityManager, userId: string) {
    const user = await manager
      .getRepository(User)
      .findOne({ where: { id: userId }, lock: { mode: 'pessimistic_write' } });
    if (!user) throw authenticationFailed();
  }

  async create(userId: string, dto: CreateAddressDto) {
    this.zone(dto.country, dto.postalCode);
    return this.db.transaction(async (manager) => {
      await this.lockUser(manager, userId);
      const repo = manager.getRepository(Address);
      if (dto.isDefault)
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      const address = await repo.save(
        repo.create({
          ...dto,
          userId,
          label: dto.label ?? null,
          line2: dto.line2 ?? null,
        }),
      );
      return publicAddress(address);
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (!Object.keys(patch).length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Renseigner au moins un champ.',
      });
    return this.db.transaction(async (manager) => {
      await this.lockUser(manager, userId);
      const repo = manager.getRepository(Address);
      const address = await repo.findOneBy({ id, userId });
      if (!address) throw new NotFoundException();
      this.zone(
        dto.country ?? address.country,
        dto.postalCode ?? address.postalCode,
      );
      if (dto.isDefault)
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      Object.assign(address, patch);
      return publicAddress(await repo.save(address));
    });
  }

  async remove(userId: string, id: string) {
    await this.db.transaction(async (manager) => {
      await this.lockUser(manager, userId);
      const result = await manager
        .getRepository(Address)
        .delete({ id, userId });
      if (!result.affected) throw new NotFoundException();
    });
  }
}
