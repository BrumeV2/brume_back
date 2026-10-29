import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

@Entity('utilisateurs')
export class User extends BaseEntity {
  @Column({
    name: 'google_sub',
    type: 'varchar',
    length: 255,
    unique: true,
    select: false,
  })
  googleSub!: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  @Column({ name: 'prenom', type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ name: 'nom', type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ name: 'telephone', type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({
    type: 'enum',
    enum: Role,
    enumName: 'user_role',
    default: Role.CUSTOMER,
  })
  role!: Role;

  @Column({
    name: 'statut',
    type: 'enum',
    enum: AccountStatus,
    enumName: 'account_status',
    default: AccountStatus.ACTIVE,
  })
  status!: AccountStatus;

  @Column({ name: 'email_verifie_at', type: 'timestamptz' })
  emailVerifiedAt!: Date;
}
