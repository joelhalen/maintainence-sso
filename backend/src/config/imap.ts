import { ImapFlow } from 'imapflow';

export function getImapConfigStatus() {
  return {
    imapHost: Boolean(process.env.IMAP_HOST),
    imapPort: Boolean(process.env.IMAP_PORT),
    imapSecure: process.env.IMAP_SECURE !== 'false',
    imapUser: Boolean(process.env.IMAP_USER),
    imapPass: Boolean(process.env.IMAP_PASS),
    imapMailbox: process.env.IMAP_MAILBOX || 'INBOX',
    pollingEnabled: process.env.IMAP_POLLING_ENABLED === 'true',
    pollIntervalSeconds: parseInt(process.env.IMAP_POLL_INTERVAL_SECONDS || '60'),
  };
}

export function isImapConfigured(): boolean {
  return Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS);
}

export function createImapClient(): ImapFlow {
  return new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: process.env.IMAP_SECURE !== 'false',
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASS!,
    },
    logger: false,
  });
}

export async function verifyImapConnection(): Promise<void> {
  const client = createImapClient();
  await client.connect();
  try {
    await client.mailboxOpen(process.env.IMAP_MAILBOX || 'INBOX');
  } finally {
    await client.logout();
  }
}
