import { Check, Column, Entity, ManyToOne, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Packaging } from '../enums/packaging.enum';
import { Product } from './product.entity';

export const SKU_PATTERN = /^[A-Z0-9-]{2,40}$/;

// Un format de vente d'un produit : conditionnement + grammage, avec son prix et son stock
@Entity('product_formats')
@Unique(['product', 'packaging', 'quantity'])
@Unique('UQ_product_formats_sku', ['sku'])
@Check('CHK_product_formats_sku', `"sku" ~ '^[A-Z0-9-]{2,40}$'`)
export class ProductFormat extends BaseEntity {
  // Référence vendable unique dans tout le catalogue (US-080).
  // Le défaut ne sert qu'aux formats antérieurs et aux seeds : l'API impose une saisie.
  @Column({
    type: 'varchar',
    length: 40,
    default: () =>
      `('F-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)))`,
  })
  sku: string;

  @ManyToOne(() => Product, (product) => product.formats, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  // Relation<> : évite la référence circulaire dans les métadonnées en ESM
  product: Relation<Product>;

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
