import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Box } from '../products/entities/box.entity';
import { ProductFormat } from '../products/entities/product-format.entity';
import { CartCacheService } from './cart-cache.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductFormat, Box]), AuthModule],
  controllers: [CartController],
  providers: [CartService, CartCacheService],
  exports: [CartService, CartCacheService],
})
export class CartModule {}
