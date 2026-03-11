import { OutboundProvider, type DispatchableJob, type SendResult } from '@/lib/outbound/types';

export class SmsPlaceholderProvider implements OutboundProvider {
  channel = 'SMS';
  providerName = 'sms-placeholder';

  async send(job: DispatchableJob): Promise<SendResult> {
    const normalized = job.toAddress.replace(/\D/g, '');
    if (normalized.length < 10) {
      return { ok: false, errorCode: 'invalid_phone', errorMessage: 'Phone number is invalid.', retryable: false };
    }

    return {
      ok: true,
      providerMessageId: `sms_${job.id}`,
      sentAt: new Date().toISOString(),
      detail: 'Stub SMS provider accepted message for delivery.',
    };
  }
}
