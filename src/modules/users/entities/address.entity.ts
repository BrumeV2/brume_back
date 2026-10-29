import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

@Entity('adresses')
@Index('UQ_address_default_user', ['userId'], {
  unique: true,
  where: '"is_default" = true',
})
@Check(
  'CHK_address_zone',
  `"country" = 'FR' AND "postal_code" ~ '^(0[1-9]|[1-8][0-9]|9[0-5])[0-9]{3}$' AND "postal_code" NOT LIKE '20%'`,
)
export class Address extends BaseEntity {
  @Index()
  @Column({ name: 'utilisateur_id', type: 'uuid' })
  userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'utilisateur_id' })
  user!: User;
  @Column({ type: 'varchar', length: 50, nullable: true }) label!:
    string | null;
  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;
  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;
  @Column({ type: 'varchar', length: 200 }) line1!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) line2!:
    string | null;
  @Column({ name: 'postal_code', type: 'varchar', length: 5 })
  postalCode!: string;
  @Column({ type: 'varchar', length: 100 }) city!: string;
  @Column({ type: 'char', length: 2 }) country!: string;
  @Column({ type: 'varchar', length: 20 }) phone!: string;
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;
}
