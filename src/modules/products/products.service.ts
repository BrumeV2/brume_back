import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CatalogueProductDto } from './dto/catalogue-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async findCatalogue(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<CatalogueProductDto>> {
    const [products, total] = await this.productsRepository.findAndCount({
      relations: { ingredients: true },
      order: { name: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const data = products.map((product) => ({
      id: product.id,
      name: product.name,
      typeTea: product.typeTea,
      origin: product.origin,
      ingredients: product.ingredients.map((ingredient) => ingredient.name),
      price: product.price,
      moment: product.moment,
      image: product.image,
    }));

    return new PaginatedResponseDto(data, total, query);
  }
}
