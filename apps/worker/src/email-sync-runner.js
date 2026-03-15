const path = require('node:path');
const crypto = require('node:crypto');

const apiModule = require(path.resolve(__dirname, '../../api/src/index.js'));

async function main() {
  const workerId = process.env.WORKER_ID || `worker:${crypto.randomUUID()}`;
  const limit = Number(process.env.EMAIL_SYNC_BATCH_LIMIT || 10);
  const claimed = apiModule.claimDueEmailSyncAccounts({ workerId, limit });
  console.log(`[email-sync-runner] claimed ${claimed.length} account(s) as ${workerId}`);

  for (const state of claimed) {
    try {
      const result = await apiModule.runEmailSyncForAccount({ emailAccountId: state.email_account_id, workerId });
      console.log(`[email-sync-runner] synced ${state.email_account_id}: checked=${result.checked || 0} imported=${result.imported?.length || 0} skipped=${result.skipped?.length || 0}`);
    } catch (error) {
      console.error(`[email-sync-runner] failed ${state.email_account_id}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error('[email-sync-runner] fatal error', error);
  process.exit(1);
});
