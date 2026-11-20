import { CartItemResponseDto } from '../dto/cart-item-response.dto';
import { CartWarningDto } from '../dto/cart-response.dto';
import { CartDiscrepancyDto } from '../dto/cart-validation-response.dto';

export interface CheckoutContext {
  id: string;
  cartId: string;
  version: number;
  status: 'valid' | 'changed' | 'blocked' | 'empty';
  itemsCount: number;
  itemsTotalCents: number;
  items: CartItemResponseDto[];
  warnings: CartWarningDto[];
  discrepancies: CartDiscrepancyDto[];
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
}
