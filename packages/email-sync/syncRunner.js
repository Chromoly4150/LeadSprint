function createSyncRunner({ claimDueEmailSyncAccounts, runAccountSync }) {
  return async function syncRunner({ workerId, limit = 10 }) {
    const claimed = claimDueEmailSyncAccounts({ workerId, limit });
    const results = [];
    for (const state of claimed) {
      try {
        const result = await runAccountSync({ emailAccountId: state.email_account_id, workerId });
        results.push({ emailAccountId: state.email_account_id, ok: true, result });
      } catch (error) {
        results.push({ emailAccountId: state.email_account_id, ok: false, error: error.message });
      }
    }
    return { claimed, results };
  };
}

module.exports = { createSyncRunner };
