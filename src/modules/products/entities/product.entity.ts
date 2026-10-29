import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CaffeineLevel } from '../enums/caffeine-level.enum';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { Box } from './box.entity';
import { Ingredient } from './ingredient.entity';
import { ProductFormat } from './product-format.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  origin: string | null;

  @Column({ type: 'varchar', nullable: true })
  typeTea: string | null;

  // image encodée en base64
  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ type: 'enum', enum: CaffeineLevel })
  howMuchCaffeine: CaffeineLevel;

  @Column({ type: 'enum', enum: ConsumptionMoment })
  moment: ConsumptionMoment;

  // au moins 1 format : vérifié dans le service
  @OneToMany(() => ProductFormat, (format) => format.product, {
    cascade: true,
  })
  formats: ProductFormat[];

  // au moins 1 ingrédient : vérifié dans le service
  @ManyToMany(() => Ingredient, (ingredient) => ingredient.products)
  @JoinTable({
    name: 'product_ingredients',
    joinColumn: { name: 'productId' },
    inverseJoinColumn: { name: 'ingredientId' },
  })
  ingredients: Ingredient[];

  @ManyToMany(() => Box, (box) => box.products)
  boxes: Box[];
}
