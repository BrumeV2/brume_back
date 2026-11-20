import { Injectable } from '@nestjs/common';
import { MailConfig } from '../../config/mail.config';
import { Mail } from './entities/mail.entity';
import { renderEmail } from './templates';

export class EmailDeliveryError extends Error {
  constructor(
    readonly category: 'retry' | 'failed' | 'uncertain',
    readonly safeCode: string,
  ) {
    super(safeCode);
  }
}
@Injectable()
export class MailjetTransport {
  constructor(private readonly config: MailConfig) {}
  async send(
    mail: Mail,
    content: ReturnType<typeof renderEmail>,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64')}`,
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: this.config.fromEmail,
                Name: this.config.fromName,
              },
              To: [{ Email: mail.recipient }],
              Subject: content.subject,
              TextPart: content.text,
              HTMLPart: content.html,
              CustomID: mail.id,
              CustomCampaign: `brume-${mail.id}`,
              DeduplicateCampaign: true,
              TrackOpens: 'disabled',
              TrackClicks: 'disabled',
            },
          ],
        }),
      });
    } catch (error) {
      const cause =
        error instanceof Error
          ? (error.cause as { code?: string } | undefined)?.code
          : undefined;
      // Only failures known to occur before transmission can safely be retried.
      if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(cause ?? ''))
        throw new EmailDeliveryError('retry', 'MAILJET_UNREACHABLE');
      throw new EmailDeliveryError('uncertain', 'MAILJET_RESPONSE_UNKNOWN');
    }
    if (response.status === 429)
      throw new EmailDeliveryError('retry', 'MAILJET_RATE_LIMIT');
    if (response.status >= 500)
      throw new EmailDeliveryError('uncertain', 'MAILJET_SERVER_ERROR');
    if (!response.ok)
      throw new EmailDeliveryError('failed', `MAILJET_HTTP_${response.status}`);
    try {
      const data = (await response.json()) as {
        Messages?: { Status?: string; To?: { MessageUUID?: string }[] }[];
      };
      const message = data.Messages?.[0];
      if (message?.Status === 'error')
        throw new EmailDeliveryError('failed', 'MAILJET_REJECTED');
      const id = message?.To?.[0]?.MessageUUID;
      if (message?.Status !== 'success' || !id)
        throw new EmailDeliveryError('uncertain', 'MAILJET_INVALID_RESPONSE');
      return id;
    } catch (error) {
      if (error instanceof EmailDeliveryError) throw error;
      throw new EmailDeliveryError('uncertain', 'MAILJET_INVALID_RESPONSE');
    }
  }
}
