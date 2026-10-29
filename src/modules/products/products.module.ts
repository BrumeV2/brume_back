import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Box } from './entities/box.entity';
import { Ingredient } from './entities/ingredient.entity';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Ingredient, Box])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
