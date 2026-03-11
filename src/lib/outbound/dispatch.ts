import { getLeadDetail, getOutboundJob, markOutboundJobFailed, markOutboundJobProcessing, markOutboundJobSent, queuedOutboundJobs, writeAuditLog } from '@/lib/db';
import { resolveOutboundProvider } from '@/lib/outbound/registry';
import type { DispatchableJob } from '@/lib/outbound/types';

export async function dispatchOutboundJob(jobId: string, actor: { id: string; name: string }) {
  const job = getOutboundJob(jobId) as DispatchableJob | null;
  if (!job) throw new Error('Outbound job not found');

  markOutboundJobProcessing(jobId);
  const provider = resolveOutboundProvider(job);
  const result = await provider.send(job);
  const lead = getLeadDetail(job.leadId);

  if (result.ok) {
    markOutboundJobSent(jobId, result.providerMessageId, result.detail);
    if (lead) {
      writeAuditLog({
        organizationId: lead.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: 'outbound.job_dispatched',
        targetType: 'outbound_job',
        targetId: jobId,
        metadata: { provider: job.provider, providerMessageId: result.providerMessageId },
      });
    }
    return { ok: true as const, jobId, providerMessageId: result.providerMessageId };
  }

  markOutboundJobFailed(jobId, result.errorMessage, result.errorCode);
  if (lead) {
    writeAuditLog({
      organizationId: lead.organizationId,
      actorId: actor.id,
      actorName: actor.name,
      action: 'outbound.job_dispatch_failed',
      targetType: 'outbound_job',
      targetId: jobId,
      metadata: { provider: job.provider, errorCode: result.errorCode, retryable: result.retryable },
    });
  }
  return { ok: false as const, jobId, errorCode: result.errorCode, errorMessage: result.errorMessage };
}

export async function dispatchQueuedOutboundJobs(actor: { id: string; name: string }, limit = 10) {
  const jobs = queuedOutboundJobs().slice(0, limit);
  const results = [] as Array<Awaited<ReturnType<typeof dispatchOutboundJob>>>;
  for (const job of jobs) {
    results.push(await dispatchOutboundJob(job.id, actor));
  }
  return results;
}
