import { Check, Column, Entity, Index, ManyToOne, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Profile } from '../../users/entities/profile.entity';
import { ProfileProductType } from '../enums/profile-product-type.enum';
import { Product } from './product.entity';

// Lien profil ↔ produit : favori, création (TeaOMatic) ou avis.
// Un seul lien de chaque type par profil et par produit.
@Entity('profile_products')
@Unique(['profile', 'product', 'type'])
@Check(`"note" IS NULL OR "note" BETWEEN 1 AND 5`)
@Check(`"type" = 'review' OR ("note" IS NULL AND "review" IS NULL)`)
export class ProfileProduct extends BaseEntity {
  @ManyToOne(() => Profile, { nullable: false, onDelete: 'CASCADE' })
  profile: Relation<Profile>;

  // Index : agrégats de notes calculés par produit dans le catalogue
  @Index()
  @ManyToOne(() => Product, (product) => product.profileProducts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  product: Relation<Product>;

  @Column({ type: 'enum', enum: ProfileProductType })
  type: ProfileProductType;

  // étoiles de 1 à 5, uniquement pour un avis
  @Column({ type: 'int', nullable: true })
  note: number | null;

  // texte de l'avis, uniquement pour un avis
  @Column({ type: 'text', nullable: true })
  review: string | null;
}
