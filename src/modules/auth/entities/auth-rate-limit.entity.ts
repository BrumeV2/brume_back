import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

// Transient distributed counter, not a domain entity. No raw IP is stored.
@Entity('auth_rate_limits')
export class AuthRateLimit {
  @PrimaryColumn({ name: 'key_hash', type: 'varchar', length: 64 })
  keyHash!: string;

  @Column({ type: 'integer' })
  attempts!: number;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
