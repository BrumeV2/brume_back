import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

@Entity('profils')
export class Profile extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'utilisateur_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'utilisateur_id' })
  user!: User;

  @Column({ name: 'prenom', type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ name: 'nom', type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ name: 'telephone', type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'adresse', type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ name: 'code_postal', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'ville', type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ name: 'points_fidelite', type: 'integer', default: 0 })
  loyaltyPoints!: number;

  @Column({ name: 'do_newsletter', type: 'boolean', default: false })
  doNewsletter!: boolean;
}
