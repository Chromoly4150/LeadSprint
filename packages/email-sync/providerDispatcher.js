function createProviderDispatcher({ syncGmailInboundForAccount, syncMicrosoftInboundForAccount }) {
  return {
    async dispatch({ providerKey, orgId, account, actorName }) {
      if (providerKey === 'gmail') return syncGmailInboundForAccount({ orgId, account, actorName });
      if (providerKey === 'microsoft') return syncMicrosoftInboundForAccount({ orgId, account, actorName });
      throw new Error('Background sync not implemented for this provider');
    },
  };
}

module.exports = { createProviderDispatcher };
