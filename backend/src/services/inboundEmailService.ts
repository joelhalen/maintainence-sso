import { simpleParser, ParsedMail, Attachment as ParsedAttachment } from 'mailparser';
import { AddressObject } from 'mailparser';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import prisma from '../config/database';
import { writeAudit } from './auditService';
import { logger } from '../config/logger';
import { AuditAction, EmailMessageStatus } from '@prisma/client';

const TICKET_TOKEN_RE = /ticket-([A-Z]+-\d{4}-\d{5})/i;
const SUBJECT_TICKET_RE = /\[?([A-Z]+-\d{4}-\d{5})\]?/i;
const EMAIL_ATTACHMENT_DIR = 'email-attachments';

interface InboundEmailInput {
  raw: Buffer;
  provider?: string;
}

function normalizeAddressList(addresses?: AddressObject | AddressObject[]): string[] {
  const list = Array.isArray(addresses) ? addresses : addresses ? [addresses] : [];
  return list.flatMap((addr) => addr.value.map((value) => value.address).filter(Boolean)) as string[];
}

function normalizeFrom(parsed: ParsedMail): string {
  return normalizeAddressList(parsed.from)[0] || 'unknown';
}

function normalizeReferences(references: ParsedMail['references']): string[] {
  if (!references) return [];
  return Array.isArray(references) ? references : [references];
}

function parseTicketNumber(parsed: ParsedMail): string | undefined {
  const addresses = [...normalizeAddressList(parsed.to), ...normalizeAddressList(parsed.cc)];
  for (const address of addresses) {
    const match = address.match(TICKET_TOKEN_RE);
    if (match) return match[1].toUpperCase();
  }

  const subjectMatch = parsed.subject?.match(SUBJECT_TICKET_RE);
  return subjectMatch?.[1]?.toUpperCase();
}

async function findTicket(parsed: ParsedMail) {
  const ticketNumber = parseTicketNumber(parsed);
  if (ticketNumber) {
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
    if (ticket) return ticket;
  }

  const referenceIds = [parsed.inReplyTo, ...normalizeReferences(parsed.references)].filter(Boolean) as string[];
  if (!referenceIds.length) return null;

  const original = await prisma.emailMessage.findFirst({
    where: { messageId: { in: referenceIds }, ticketId: { not: null } },
    include: { ticket: true },
  });
  return original?.ticket || null;
}

async function getOrCreateInboundEmailUser(organizationId: string) {
  const email = `inbound-email+${organizationId}@system.megamtx.local`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const role = await prisma.role.findFirst({
    where: { organizationId },
    orderBy: [{ name: 'asc' }],
  });
  if (!role) throw new Error('Cannot create inbound email user without an organization role');

  return prisma.user.create({
    data: {
      organizationId,
      email,
      name: 'Inbound Email',
      roleId: role.id,
      active: false,
    },
  });
}

async function findCommentAuthor(organizationId: string, fromEmail: string) {
  const sender = await prisma.user.findFirst({
    where: { organizationId, email: fromEmail.toLowerCase() },
  });
  return sender || getOrCreateInboundEmailUser(organizationId);
}

async function storeAttachments(
  organizationId: string,
  emailMessageId: string,
  attachments: ParsedAttachment[]
) {
  if (!attachments.length) return;

  const baseDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', EMAIL_ATTACHMENT_DIR);
  await fs.mkdir(baseDir, { recursive: true });

  for (const attachment of attachments) {
    const ext = path.extname(attachment.filename || '');
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(baseDir, filename);
    await fs.writeFile(filePath, attachment.content);

    await prisma.emailAttachment.create({
      data: {
        organizationId,
        emailMessageId,
        filename,
        originalName: attachment.filename || filename,
        contentType: attachment.contentType || 'application/octet-stream',
        sizeBytes: attachment.size || attachment.content.length,
        path: path.join(EMAIL_ATTACHMENT_DIR, filename),
      },
    });
  }
}

export async function processInboundEmail(input: InboundEmailInput) {
  const parsed = await simpleParser(input.raw);
  const messageId = parsed.messageId || `${uuidv4()}@generated.megamtx.local`;
  const existing = await prisma.emailMessage.findFirst({ where: { messageId } });
  if (existing) return existing;

  const ticket = await findTicket(parsed);
  const organizationId = ticket?.organizationId || process.env.DEFAULT_ORGANIZATION_ID;
  if (!organizationId) {
    logger.warn('Inbound email ignored because no organization could be determined', {
      messageId,
      subject: parsed.subject,
      from: normalizeFrom(parsed),
    });
    return null;
  }

  const from = normalizeFrom(parsed).toLowerCase();
  const author = ticket ? await findCommentAuthor(organizationId, from) : null;
  const receivedAt = parsed.date || new Date();

  const emailMessage = await prisma.emailMessage.create({
    data: {
      organizationId,
      direction: 'INBOUND',
      provider: input.provider || 'imap',
      messageId,
      inReplyTo: parsed.inReplyTo,
      references: normalizeReferences(parsed.references),
      from,
      to: normalizeAddressList(parsed.to),
      cc: normalizeAddressList(parsed.cc),
      subject: parsed.subject || '(no subject)',
      textBody: parsed.text,
      htmlBody: typeof parsed.html === 'string' ? parsed.html : undefined,
      status: ticket ? 'PROCESSED' : 'RECEIVED',
      receivedAt,
      processedAt: ticket ? new Date() : undefined,
      ticketId: ticket?.id,
      userId: author?.id,
    },
  });

  await storeAttachments(organizationId, emailMessage.id, parsed.attachments);

  if (ticket && author) {
    const body = parsed.text?.trim() || 'Inbound email received with no plain-text body.';
    const comment = await prisma.ticketComment.create({
      data: {
        organizationId,
        ticketId: ticket.id,
        authorId: author.id,
        content: `Email reply from ${from}:\n\n${body}`,
        isInternal: false,
      },
    });

    await writeAudit({
      organizationId,
      userId: author.id,
      action: AuditAction.CREATE,
      resource: 'ticket_comments',
      resourceId: comment.id,
      newValues: { ticketId: ticket.id, emailMessageId: emailMessage.id },
      notes: 'Inbound email reply converted to ticket comment',
    });
  }

  return emailMessage;
}

export async function markInboundEmailFailed(emailMessageId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.emailMessage.update({
    where: { id: emailMessageId },
    data: { status: EmailMessageStatus.FAILED, errorMessage: message },
  });
}
