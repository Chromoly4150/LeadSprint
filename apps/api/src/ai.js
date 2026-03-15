const crypto = require('crypto');

const AI_PROVIDERS = {
  stub: {
    key: 'stub',
    label: 'LeadSprint Stub AI',
    model: 'stub/draft-v1',
  },
  openai: {
    key: 'openai',
    label: 'OpenAI-compatible',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
};

function getAiProvider(key = 'stub') {
  return AI_PROVIDERS[key] || AI_PROVIDERS.stub;
}

function getModelPolicy(settings) {
  return settings?.model_policy_json || settings?.model_policy || {};
}

function estimateTokens(text = '') {
  return Math.max(1, Math.ceil(String(text).length / 4));
}


async function runOpenAiLeadResponse({ org, lead, settings, providerKey }) {
  const modelPolicy = getModelPolicy(settings);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const businessName = settings?.business_context_json?.businessName || settings?.business_context?.businessName || org?.name;
  const bookingLink = settings?.business_context_json?.bookingLink || settings?.business_context?.bookingLink || null;
  const tone = settings?.tone_profile_json?.defaultTone || settings?.tone_profile?.defaultTone || 'professional and warm';
  const model = modelPolicy.primaryModel || process.env.OPENAI_MODEL || AI_PROVIDERS.openai.model;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

  const systemPrompt = [
    'You write concise first-response drafts for inbound leads.',
    `Business name: ${businessName || org?.name || 'LeadSprint'}`,
    `Tone: ${tone}`,
    bookingLink ? `Booking link: ${bookingLink}` : 'Booking link: none',
    'Return strict JSON with keys: subject, draft, tone.',
  ].join('\n');

  const userPrompt = JSON.stringify({
    workflow: 'lead_reply_draft',
    organization: { id: org?.id, name: org?.name },
    lead: {
      id: lead?.id,
      fullName: lead?.full_name,
      email: lead?.email || null,
      phone: lead?.phone || null,
      source: lead?.source || null,
      message: lead?.message || null,
      urgencyStatus: lead?.urgency_status || null,
    },
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenAI request failed: ${response.status}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI provider returned invalid JSON');
  }

  const output = {
    subject: String(parsed.subject || `Follow-up from ${businessName || org?.name || 'LeadSprint'}`),
    draft: String(parsed.draft || '').trim(),
    tone: String(parsed.tone || tone),
  };

  if (!output.draft) throw new Error('AI provider returned an empty draft');

  return {
    provider: providerKey,
    model,
    output,
    inputTokens: Number(json?.usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt)),
    outputTokens: Number(json?.usage?.completion_tokens || estimateTokens(output.draft)),
    estimatedCost: 0,
    providerRunId: json?.id || `airun_${crypto.randomUUID()}`,
    rawResponse: json,
  };
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
  const modelPolicy = getModelPolicy(settings);
  const requestedProvider = modelPolicy.primaryProvider || 'stub';
  if (requestedProvider !== 'stub') {
    return runOpenAiLeadResponse({ org, lead, settings, providerKey: requestedProvider });
  }

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
