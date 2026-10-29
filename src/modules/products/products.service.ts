import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    // Pagination sur les produits seuls : trier en SQL sur une relation fausse skip/take
    const [page, total] = await this.productsRepository.findAndCount({
      select: { id: true },
      order: { name: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const products = await this.productsRepository.find({
      where: { id: In(page.map((product) => product.id)) },
      relations: { ingredients: true, formats: true },
      order: { name: 'ASC', id: 'ASC' },
    });

    const data = products.map((product) => ({
      id: product.id,
      name: product.name,
      typeTea: product.typeTea,
      origin: product.origin,
      ingredients: product.ingredients.map((ingredient) => ingredient.name),
      price: Math.min(...product.formats.map((format) => format.price)),
      moment: product.moment,
      image: product.image,
      formats: product.formats
        .sort((a, b) => a.price - b.price || a.quantity - b.quantity)
        .map((format) => ({
          id: format.id,
          packaging: format.packaging,
          quantity: format.quantity,
          price: format.price,
          stock: format.stock,
        })),
    }));

    return new PaginatedResponseDto(data, total, query);
  }
}
