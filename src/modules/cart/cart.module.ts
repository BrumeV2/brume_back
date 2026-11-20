import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Box } from '../products/entities/box.entity';
import { ProductFormat } from '../products/entities/product-format.entity';
import { CartCacheService } from './cart-cache.service';
import { CartController } from './cart.controller';
import { CartPricingService } from './cart-pricing.service';
import { CartService } from './cart.service';
import { CheckoutContextService } from './checkout-context.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductFormat, Box]), AuthModule],
  controllers: [CartController],
  providers: [
    CartService,
    CartCacheService,
    CartPricingService,
    CheckoutContextService,
  ],
  exports: [
    CartService,
    CartCacheService,
    CartPricingService,
    CheckoutContextService,
  ],
})
export class CartModule {}
