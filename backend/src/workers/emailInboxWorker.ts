import { createImapClient, isImapConfigured } from '../config/imap';
import { processInboundEmail } from '../services/inboundEmailService';
import { logger } from '../config/logger';

let running = false;
let timer: NodeJS.Timeout | null = null;

export async function pollEmailInbox(): Promise<{ processed: number; failed: number }> {
  if (!isImapConfigured()) {
    return { processed: 0, failed: 0 };
  }

  const client = createImapClient();
  let processed = 0;
  let failed = 0;

  await client.connect();
  try {
    const mailbox = await client.mailboxOpen(process.env.IMAP_MAILBOX || 'INBOX');
    const maxMessages = Math.max(1, parseInt(process.env.IMAP_MAX_MESSAGES_PER_POLL || '50'));
    const start = Math.max(1, mailbox.exists - maxMessages + 1);
    const range = mailbox.exists > 0 ? `${start}:*` : '';

    if (!range) return { processed, failed };

    for await (const message of client.fetch(range, { source: true })) {
      if (!message.source) continue;
      try {
        const saved = await processInboundEmail({ raw: Buffer.from(message.source), provider: 'imap' });
        if (saved) processed += 1;
      } catch (error) {
        failed += 1;
        logger.error('Inbound email processing failed', { error });
      }
    }
  } finally {
    await client.logout();
  }

  return { processed, failed };
}

export function startEmailInboxWorker() {
  if (running || process.env.IMAP_POLLING_ENABLED !== 'true') return;
  running = true;

  const intervalMs = Math.max(15, parseInt(process.env.IMAP_POLL_INTERVAL_SECONDS || '60')) * 1000;

  const tick = async () => {
    try {
      const result = await pollEmailInbox();
      if (result.processed || result.failed) {
        logger.info('Inbound email poll complete', result);
      }
    } catch (error) {
      logger.error('Inbound email poll failed', { error });
    }
  };

  timer = setInterval(tick, intervalMs);
  tick().catch((error) => logger.error('Initial inbound email poll failed', { error }));
}

export function stopEmailInboxWorker() {
  if (timer) clearInterval(timer);
  timer = null;
  running = false;
}
