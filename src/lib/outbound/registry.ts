import { GmailProvider } from '@/lib/outbound/providers/gmail';
import { SmsPlaceholderProvider } from '@/lib/outbound/providers/sms-placeholder';
import type { DispatchableJob, OutboundProvider } from '@/lib/outbound/types';

const providers: OutboundProvider[] = [
  new GmailProvider(),
  new SmsPlaceholderProvider(),
];

export function resolveOutboundProvider(job: DispatchableJob) {
  const provider = providers.find((candidate) => candidate.providerName === job.provider && candidate.channel === job.channel);
  if (!provider) throw new Error(`No outbound provider registered for ${job.provider}/${job.channel}`);
  return provider;
}
