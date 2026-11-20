import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MailConfig } from '../../config/mail.config';
import { Mail, MailStatus as Status } from './entities/mail.entity';
import { decryptPayload } from './payload-cipher';
import { EmailPayload, renderEmail } from './templates';
import { EmailDeliveryError, MailjetTransport } from './mailjet.transport';

@Injectable()
export class MailWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger(MailWorker.name);
  constructor(
    private readonly db: DataSource,
    private readonly config: MailConfig,
    private readonly transport: MailjetTransport,
  ) {}
  onApplicationBootstrap() {
    if (!this.config.enabled) return;
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('EMAIL_WORKER_DATABASE_ERROR'),
      );
    }, this.config.pollMs);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  async tick() {
    if (this.running || !this.config.enabled) return;
    this.running = this.processBatch();
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }
  private async processBatch() {
    const repo = this.db.getRepository(Mail);
    // A crashed process may already have transmitted the email. Never auto-resend it.
    await repo
      .createQueryBuilder()
      .update()
      .set({ status: Status.UNCERTAIN, lastError: 'WORKER_INTERRUPTED' })
      .where(
        "status = :status AND updated_at < now() - interval '10 minutes'",
        { status: Status.SENDING },
      )
      .execute();
    for (let i = 0; i < 20; i++) {
      const item = await this.db.transaction(async (manager) => {
        const repository = manager.getRepository(Mail);
        const mail = await repository
          .createQueryBuilder('n')
          .addSelect('n.payload')
          .where('n.status IN (:...states) AND n.next_attempt_at <= now()', {
            states: [Status.PENDING, Status.RETRY],
          })
          .orderBy('n.created_at', 'ASC')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getOne();
        if (!mail) return null;
        mail.status = Status.SENDING;
        mail.attempts++;
        await repository.save(mail);
        return mail;
      });
      if (!item) return;
      this.logger.log(
        JSON.stringify({
          event: 'MAIL_SENDING',
          mailId: item.id,
          attempt: item.attempts,
        }),
      );
      let providerId: string;
      let sending = false;
      try {
        const payload = decryptPayload(
          item.payload!,
          this.config.encryptionKey,
        ) as EmailPayload;
        if (payload.expiresAt && Date.parse(payload.expiresAt) <= Date.now()) {
          await repo.update(
            { id: item.id, status: Status.SENDING },
            {
              status: Status.CANCELLED,
              payload: null,
              lastError: 'LINK_EXPIRED',
            },
          );
          continue;
        }
        const content = renderEmail(
          item.kind,
          payload,
          this.config.frontendUrl,
        );
        sending = true;
        providerId = await this.transport.send(item, content);
      } catch (error) {
        const failure =
          error instanceof EmailDeliveryError
            ? error
            : new EmailDeliveryError(
                sending ? 'uncertain' : 'failed',
                sending ? 'MAILJET_RESPONSE_UNKNOWN' : 'EMAIL_PAYLOAD_INVALID',
              );
        const retry =
          failure.category === 'retry' &&
          item.attempts < this.config.maxAttempts;
        const status = retry
          ? Status.RETRY
          : failure.category === 'uncertain'
            ? Status.UNCERTAIN
            : Status.FAILED;
        await repo.update(
          { id: item.id, status: Status.SENDING },
          {
            status,
            lastError: failure.safeCode,
            nextAttemptAt: new Date(
              Date.now() + Math.min(3600, 30 * 2 ** (item.attempts - 1)) * 1000,
            ),
          },
        );
        this.logger.warn(
          `EMAIL_${status.toUpperCase()} id=${item.id} code=${failure.safeCode}`,
        );
        continue;
      }
      // Keep persistence errors outside the send catch: delivery has already succeeded.
      await repo.update(
        { id: item.id, status: Status.SENDING },
        {
          status: Status.SENT,
          sentAt: new Date(),
          providerId,
          lastError: null,
          payload: null,
        },
      );
      this.logger.log(
        JSON.stringify({
          event: 'MAIL_SENT',
          mailId: item.id,
          attempt: item.attempts,
        }),
      );
    }
  }
}
