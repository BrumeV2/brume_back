import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum MailStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  RETRY = 'retry',
  SENT = 'sent',
  FAILED = 'failed',
  UNCERTAIN = 'uncertain',
  CANCELLED = 'cancelled',
}
export type MailKind =
  'order.confirmed' | 'account.confirm' | 'account.reset' | 'email.generic';

// Keep the existing table name: this code rename does not require a schema migration.
@Entity('email_notifications')
export class Mail extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'event_key', type: 'varchar', length: 200 })
  eventKey!: string;
  @Column({ type: 'varchar', length: 40 })
  kind!: MailKind;
  @Column({ type: 'varchar', length: 254 })
  recipient!: string;
  @Column({ type: 'text', select: false, nullable: true })
  payload!: string | null;
  @Index()
  @Column({ type: 'varchar', length: 20, default: MailStatus.PENDING })
  status!: MailStatus;
  @Column({ type: 'integer', default: 0 })
  attempts!: number;
  @Index()
  @Column({
    name: 'next_attempt_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  nextAttemptAt!: Date;
  @Column({ name: 'last_error', type: 'varchar', length: 60, nullable: true })
  lastError!: string | null;
  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}
