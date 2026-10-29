import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('oauth_transactions')
export class OAuthTransaction extends BaseEntity {
  @Column({ name: 'state_hash', type: 'varchar', length: 64, unique: true })
  stateHash!: string;

  @Column({ name: 'browser_hash', type: 'varchar', length: 64 })
  browserHash!: string;

  @Column({ type: 'varchar', length: 43 })
  nonce!: string;

  @Column({ name: 'code_verifier', type: 'varchar', length: 43 })
  codeVerifier!: string;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
