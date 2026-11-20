import { Column, Entity, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import type { Profile } from './profile.entity';

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
    nullable: true,
  })
  googleSub!: string | null;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

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

  @Column({ name: 'email_verifie_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @OneToOne('Profile', 'user')
  profile?: Profile;
}
