const { ensureDb, runMigrations, nowIso } = require('../src/db');
const { getProvider } = require('../src/email');

runMigrations();
const db = ensureDb();

const queued = db.prepare(
  `SELECT * FROM email_outbox WHERE send_status = 'queued' ORDER BY queued_at ASC LIMIT 25`
).all();

for (const item of queued) {
  const provider = getProvider(item.provider_key || 'stub');
  try {
    const result = provider.send({
      toEmail: item.to_email,
      subject: item.subject,
      body: item.body,
    });
    const resolved = result && typeof result.then === 'function' ? await result : result;
    const ts = nowIso();
    db.prepare(
      `UPDATE email_outbox
       SET send_status = 'sent', sent_at = ?, updated_at = ?, last_error = NULL
       WHERE id = ?`
    ).run(ts, ts, item.id);
    console.log(`sent ${item.id} -> ${item.to_email} (${resolved.providerMessageId || 'no-msg-id'})`);
  } catch (error) {
    const ts = nowIso();
    db.prepare(
      `UPDATE email_outbox
       SET send_status = 'failed', failed_at = ?, updated_at = ?, last_error = ?
       WHERE id = ?`
    ).run(ts, ts, error?.message || 'Unknown error', item.id);
    console.error(`failed ${item.id}: ${error?.message || error}`);
  }
}

console.log(`processed ${queued.length} queued email(s)`);
