export type CartItemType = 'format' | 'box' | 'gift_card';

export interface CartGiftCardData {
  id: string;
  amount: number; // en centimes
  from?: string;
  to?: string;
  message?: string;
}

export interface CartLineCache {
  id: string;
  itemType: CartItemType;
  formatId?: string;
  boxId?: string;
  giftCard?: CartGiftCardData;
  quantity: number;
  unitPrice: number; // en centimes
  addedAt: string;
  updatedAt: string;
}

export interface CartCache {
  id: string;
  items: CartLineCache[];
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
}
