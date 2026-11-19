import { Column, Entity, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { IngredientType } from '../enums/ingredient-type.enum';
import { Product } from './product.entity';

@Entity('ingredients')
export class Ingredient extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  // Synonymes pris en compte par les recherches (ex. « badiane » pour Anis étoilé)
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  aliases: string[];

  @Column({ type: 'enum', enum: IngredientType })
  type: IngredientType;

  // en centimes
  @Column({ type: 'int' })
  price: number;

  @ManyToMany(() => Product, (product) => product.ingredients)
  products: Product[];
}
