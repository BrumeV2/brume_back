import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('boxes')
export class Box extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  // en centimes
  @Column({ type: 'int' })
  price: number;

  // au moins 1 produit : vérifié dans le service
  @ManyToMany(() => Product, (product) => product.boxes)
  @JoinTable({
    name: 'box_products',
    joinColumn: { name: 'boxId' },
    inverseJoinColumn: { name: 'productId' },
  })
  products: Product[];
}
