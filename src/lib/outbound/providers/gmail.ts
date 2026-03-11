import { OutboundProvider, type DispatchableJob, type SendResult } from '@/lib/outbound/types';

export class GmailProvider implements OutboundProvider {
  channel = 'Email';
  providerName = 'gmail';

  async send(job: DispatchableJob): Promise<SendResult> {
    if (!job.toAddress.includes('@')) {
      return { ok: false, errorCode: 'invalid_recipient', errorMessage: 'Email address is invalid.', retryable: false };
    }

    return {
      ok: true,
      providerMessageId: `gmail_${job.id}`,
      sentAt: new Date().toISOString(),
      detail: 'Stub Gmail adapter accepted message for delivery.',
    };
  }
}
