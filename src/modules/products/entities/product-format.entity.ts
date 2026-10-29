import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Packaging } from '../enums/packaging.enum';
import { Product } from './product.entity';

// Un format de vente d'un produit : conditionnement + grammage, avec son prix et son stock
@Entity('product_formats')
@Unique(['product', 'packaging', 'quantity'])
export class ProductFormat extends BaseEntity {
  @ManyToOne(() => Product, (product) => product.formats, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  product: Product;

  @Column({ type: 'enum', enum: Packaging })
  packaging: Packaging;

  // grammage, en grammes
  @Column({ type: 'int' })
  quantity: number;

  // en centimes
  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;
}
