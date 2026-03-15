function createRunAccountSyncRuntime({
  db,
  nowIso,
  getEmailAccountById,
  getEmailSyncState,
  upsertEmailSyncState,
  recordEmailSyncRunStart,
  recordEmailSyncRunFinish,
  providerDispatcher,
}) {
  return async function runAccountSync({ emailAccountId, workerId = 'api-manual' }) {
    const account = db.prepare(`SELECT * FROM email_accounts WHERE id = ? LIMIT 1`).get(emailAccountId);
    if (!account) throw new Error('Email account not found');
    const providerKey = account.provider_key || account.provider_type;
    const runId = recordEmailSyncRunStart({ organizationId: account.organization_id, emailAccountId: account.id, providerKey, workerId });
    try {
      const result = await providerDispatcher.dispatch({
        providerKey,
        orgId: account.organization_id,
        account,
        actorName: 'Background Sync',
      });
      const state = getEmailSyncState(account.id);
      upsertEmailSyncState({
        organizationId: account.organization_id,
        emailAccountId: account.id,
        providerKey,
        syncMode: state?.sync_mode || 'manual',
        lastCursor: state?.last_cursor || null,
        lastSyncedAt: state?.last_synced_at || nowIso(),
        lastStatus: 'ok',
        lastError: null,
        lockedBy: null,
        lockExpiresAt: null,
        syncIntervalMinutes: state?.sync_interval_minutes || 15,
      });
      recordEmailSyncRunFinish({
        runId,
        status: 'ok',
        importedCount: result.imported?.length || 0,
        skippedCount: result.skipped?.length || 0,
        checkedCount: result.checked || 0,
        details: result,
      });
      return result;
    } catch (error) {
      const state = getEmailSyncState(account.id);
      upsertEmailSyncState({
        organizationId: account.organization_id,
        emailAccountId: account.id,
        providerKey,
        syncMode: state?.sync_mode || 'manual',
        lastCursor: state?.last_cursor || null,
        lastSyncedAt: state?.last_synced_at || null,
        lastStatus: 'error',
        lastError: error?.message || 'Sync failed',
        lockedBy: null,
        lockExpiresAt: null,
        syncIntervalMinutes: state?.sync_interval_minutes || 15,
      });
      recordEmailSyncRunFinish({ runId, status: 'error', error: error?.message || 'Sync failed' });
      throw error;
    }
  };
}

module.exports = { createRunAccountSyncRuntime };
