import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isEmail, isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { MailConfig } from '../../config/mail.config';
import { Mail, MailKind, MailStatus as Status } from './entities/mail.entity';
import { encryptPayload } from './payload-cipher';
import { EmailPayload } from './templates';
import { GenericEmailContent, validateEmailContent } from './email-template';

export interface SendEmailInput extends GenericEmailContent {
  to: string;
  /** Stable identifier for this business event, reused on retries. */
  eventKey: string;
}

export function mailResult(item: Mail) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    eventKey: item.eventKey,
    kind: item.kind,
    recipient: item.recipient,
    status: item.status,
    attempts: item.attempts,
    nextAttemptAt: item.nextAttemptAt,
    lastError: item.lastError,
    providerId: item.providerId,
    sentAt: item.sentAt,
  };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(
    private readonly db: DataSource,
    private readonly config: MailConfig,
  ) {}
  /** Queues a branded email; the worker performs the Mailjet call after commit. */
  async sendEmail(input: SendEmailInput, manager?: EntityManager) {
    try {
      validateEmailContent(input);
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Les paramètres du mail sont invalides.',
      });
    }
    if (
      typeof input.eventKey !== 'string' ||
      !input.eventKey.trim() ||
      input.eventKey.length > 192 ||
      /[\r\n]/.test(input.eventKey)
    )
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Clé événement email invalide (1 à 192 caractères).',
      });
    // Explicit projection: do not persist arbitrary caller properties, payment objects or secrets.
    const generic: GenericEmailContent = {
      subject: input.subject,
      content: input.content,
    };
    if (input.title !== undefined) generic.title = input.title;
    if (input.preheader !== undefined) generic.preheader = input.preheader;
    if (input.action !== undefined)
      generic.action = { label: input.action.label, url: input.action.url };
    const enqueue = (transaction: EntityManager) =>
      this.enqueue(
        transaction,
        `generic:${input.eventKey}`,
        'email.generic',
        input.to,
        { generic },
      );
    const mail = manager
      ? await enqueue(manager)
      : await this.db.transaction(enqueue);
    this.logger.log(
      JSON.stringify({
        event: manager ? 'MAIL_PREPARED' : 'MAIL_QUEUED',
        mailId: mail.id,
        status: mail.status,
      }),
    );
    return mailResult(mail);
  }
  // Call with the SAME transactional manager that persists the business operation.
  async enqueueOrderConfirmation(
    manager: EntityManager,
    order: { id: string; email: string },
  ) {
    if (!isUUID(order.id)) throw new Error('Identifiant de commande invalide.');
    return this.enqueue(
      manager,
      `order.confirmed:${order.id}`,
      'order.confirmed',
      order.email,
      { orderId: order.id },
    );
  }
  async enqueueAccount(
    manager: EntityManager,
    kind: 'account.confirm' | 'account.reset',
    userId: string,
    token: string,
    expiresAt: Date,
  ) {
    const user = await manager.query<{ email: string }[]>(
      'SELECT email FROM utilisateurs WHERE id = $1',
      [userId],
    );
    await manager
      .getRepository(Mail)
      .createQueryBuilder()
      .update()
      .set({
        status: Status.CANCELLED,
        payload: null,
        lastError: 'LINK_SUPERSEDED',
      })
      .where('event_key LIKE :prefix AND status IN (:...states)', {
        prefix: `${kind}:${userId}:%`,
        states: [Status.PENDING, Status.RETRY, Status.FAILED],
      })
      .execute();
    return this.enqueue(
      manager,
      `${kind}:${userId}:${randomUUID()}`,
      kind,
      user[0].email,
      { token, expiresAt: expiresAt.toISOString() },
    );
  }
  private async enqueue(
    manager: EntityManager,
    eventKey: string,
    kind: MailKind,
    recipient: string,
    payload: EmailPayload,
  ) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new Error('Une transaction métier est obligatoire.');
    if (!isEmail(recipient) || recipient.length > 254)
      throw new Error('Destinataire invalide.');
    if (!this.config.encryptionKey) {
      this.logger.error(
        JSON.stringify({
          event: 'MAIL_CONFIGURATION_MISSING',
          setting: 'EMAIL_ENCRYPTION_KEY',
        }),
      );
      throw new ServiceUnavailableException({
        code: 'MAIL_CONFIGURATION_MISSING',
        message: 'Le service email est temporairement indisponible.',
      });
    }
    const repo = manager.getRepository(Mail);
    await repo
      .createQueryBuilder()
      .insert()
      .values({
        eventKey,
        kind,
        recipient,
        payload: encryptPayload(payload, this.config.encryptionKey),
      })
      .orIgnore()
      .execute();
    return repo.findOneByOrFail({ eventKey });
  }
  async list(page: number, limit: number) {
    const [items, total] = await this.db.getRepository(Mail).findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: items.map(mailResult), total, page, limit };
  }
  async retry(id: string) {
    // Atomic compare-and-set: two operators cannot race a worker or revive a sent email.
    const result = await this.db.getRepository(Mail).update(
      { id, status: In([Status.FAILED, Status.RETRY]) },
      {
        status: Status.PENDING,
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    );
    if (!result.affected) {
      if (!(await this.db.getRepository(Mail).existsBy({ id })))
        throw new NotFoundException({
          code: 'MAIL_NOT_FOUND',
          message: 'Email introuvable.',
        });
      throw new ConflictException({
        code: 'MAIL_RETRY_NOT_ALLOWED',
        message:
          'Cet envoi ne peut pas être repris (envoyé, en cours ou incertain).',
      });
    }
    this.logger.log(JSON.stringify({ event: 'MAIL_RETRY_QUEUED', mailId: id }));
    return mailResult(
      await this.db.getRepository(Mail).findOneByOrFail({ id }),
    );
  }
}
