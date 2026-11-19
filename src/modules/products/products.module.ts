import { AvailabilityService } from './availability/availability.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Box } from './entities/box.entity';
import { Ingredient } from './entities/ingredient.entity';
import { ProductFormat } from './entities/product-format.entity';
import { Product } from './entities/product.entity';
import { ProfileProduct } from './entities/profile-product.entity';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductFormat,
      Ingredient,
      Box,
      ProfileProduct,
    ]),
  ],
  controllers: [ProductsController, IngredientsController],
  providers: [ProductsService, IngredientsService, AvailabilityService],
  exports: [AvailabilityService],
})
export class ProductsModule {}
