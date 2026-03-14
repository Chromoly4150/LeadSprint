const crypto = require('crypto');

const AI_PROVIDERS = {
  stub: {
    key: 'stub',
    label: 'LeadSprint Stub AI',
    model: 'stub/draft-v1',
  },
};

function getAiProvider(key = 'stub') {
  return AI_PROVIDERS[key] || AI_PROVIDERS.stub;
}

function estimateTokens(text = '') {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

function buildLeadResponseDraft({ orgName, businessName, leadName, leadMessage, bookingLink, tone = 'professional and warm' }) {
  const greeting = leadName ? `Hi ${leadName},` : 'Hi,';
  const summary = leadMessage ? ` Thanks for reaching out${businessName ? ` to ${businessName}` : ''} about "${leadMessage.trim()}".` : ` Thanks for reaching out${businessName ? ` to ${businessName}` : ''}.`;
  const booking = bookingLink ? ` If you'd like, you can book time here: ${bookingLink}` : '';
  const body = `${greeting}\n\n${summary} We can help, and we'll follow up shortly.${booking}\n\nBest,\n${businessName || orgName || 'LeadSprint'}`;
  return {
    draft: body,
    subject: `Follow-up from ${businessName || orgName || 'LeadSprint'}`,
    tone,
  };
}

async function runDraftOnlyLeadResponse({ org, lead, settings }) {
  const provider = getAiProvider('stub');
  const businessName = settings?.business_context_json?.businessName || settings?.business_context?.businessName || org?.name;
  const bookingLink = settings?.business_context_json?.bookingLink || settings?.business_context?.bookingLink || null;
  const tone = settings?.tone_profile_json?.defaultTone || settings?.tone_profile?.defaultTone || 'professional and warm';

  const output = buildLeadResponseDraft({
    orgName: org?.name,
    businessName,
    leadName: lead?.full_name,
    leadMessage: lead?.message,
    bookingLink,
    tone,
  });

  const promptShape = JSON.stringify({
    orgId: org?.id,
    leadId: lead?.id,
    workflow: 'lead_reply_draft',
    tone,
  });

  return {
    provider: provider.key,
    model: provider.model,
    output,
    inputTokens: estimateTokens(promptShape + (lead?.message || '')),
    outputTokens: estimateTokens(output.draft),
    estimatedCost: 0,
    providerRunId: `airun_${crypto.randomUUID()}`,
  };
}

module.exports = {
  getAiProvider,
  runDraftOnlyLeadResponse,
};
