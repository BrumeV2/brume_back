import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { CaffeineLevel } from '../enums/caffeine-level.enum';
import { ConsumptionMoment } from '../enums/consumption-moment.enum';
import { Box } from './box.entity';
import { Ingredient } from './ingredient.entity';
import { ProductFormat } from './product-format.entity';
import { ProfileProduct } from './profile-product.entity';

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

  // un produit non publié n'apparaît sur aucune route publique (catalogue, fiche, similaires, choix de filtres)
  // Défaut base à true pour les données antérieures ; l'API de création démarre en brouillon (false)
  @Column({ type: 'boolean', default: true })
  published: boolean;

  // Audit : compte à l'origine de la création, null pour les données antérieures
  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'createdById',
    foreignKeyConstraintName: 'FK_products_created_by',
  })
  createdBy?: Relation<User> | null;

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

  // favoris, créations et avis des clients
  @OneToMany(() => ProfileProduct, (link) => link.product)
  profileProducts: ProfileProduct[];
}
