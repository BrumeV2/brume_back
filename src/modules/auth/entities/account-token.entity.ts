import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
@Entity('account_tokens')
export class AccountToken extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
  @Column({ type: 'varchar', length: 20 })
  purpose!: 'confirm' | 'reset';
  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 64,
    unique: true,
    select: false,
  })
  tokenHash!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
