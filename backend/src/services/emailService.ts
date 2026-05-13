import { emailTransport } from '../config/email';
import prisma from '../config/database';
import { logger } from '../config/logger';
import { EmailOptions } from '../types';

const FROM = `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`;

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const toArray = Array.isArray(options.to) ? options.to : [options.to];
  const ccArray = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];

  const log = await prisma.emailLog.create({
    data: {
      to: toArray,
      cc: ccArray,
      subject: options.subject,
      templateName: options.templateName,
      status: 'PENDING',
      ticketId: options.ticketId,
    },
  });

  try {
    const result = await emailTransport.sendMail({
      from: FROM,
      to: toArray.join(', '),
      cc: ccArray.join(', ') || undefined,
      subject: options.subject,
      html: options.html,
      text: options.text || htmlToText(options.html),
    });

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorMessage: message },
    });
    logger.error('Email send failed', { error: message, to: toArray, subject: options.subject });
    return false;
  }
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Email Templates ──────────────────────────────────────────────────────────

interface TicketEmailData {
  ticketNumber: string;
  title: string;
  priority: string;
  status: string;
  location: string;
  asset?: string;
  assignedTo?: string;
  createdBy: string;
  dueDate?: string;
  description: string;
  ticketUrl: string;
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
  .container{max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:#1a56db;color:#fff;padding:24px;text-align:center}
  .header h1{margin:0;font-size:20px}
  .body{padding:24px}
  .field{margin-bottom:12px}
  .label{font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600}
  .value{font-size:14px;color:#111827;margin-top:2px}
  .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600}
  .badge-critical{background:#fee2e2;color:#dc2626}
  .badge-high{background:#ffedd5;color:#ea580c}
  .badge-medium{background:#fef9c3;color:#ca8a04}
  .badge-low{background:#dcfce7;color:#16a34a}
  .btn{display:inline-block;padding:10px 24px;background:#1a56db;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;margin-top:16px}
  .footer{padding:16px 24px;background:#f9fafb;font-size:12px;color:#9ca3af;text-align:center}
</style></head>
<body><div class="container">
  <div class="header"><h1>${process.env.COMPANY_NAME} Maintenance</h1></div>
  <div class="body">${content}</div>
  <div class="footer">This is an automated notification from ${process.env.COMPANY_NAME} Maintenance System.</div>
</div></body></html>`;
}

export function ticketCreatedTemplate(data: TicketEmailData): string {
  return baseTemplate(`
    <h2 style="margin-top:0">New Ticket Created</h2>
    <div class="field"><div class="label">Ticket #</div><div class="value">${data.ticketNumber}</div></div>
    <div class="field"><div class="label">Title</div><div class="value">${data.title}</div></div>
    <div class="field"><div class="label">Priority</div><div class="value"><span class="badge badge-${data.priority.toLowerCase()}">${data.priority}</span></div></div>
    <div class="field"><div class="label">Location</div><div class="value">${data.location}</div></div>
    ${data.asset ? `<div class="field"><div class="label">Asset</div><div class="value">${data.asset}</div></div>` : ''}
    <div class="field"><div class="label">Created By</div><div class="value">${data.createdBy}</div></div>
    ${data.dueDate ? `<div class="field"><div class="label">Due Date</div><div class="value">${data.dueDate}</div></div>` : ''}
    <div class="field"><div class="label">Description</div><div class="value">${data.description}</div></div>
    <a href="${data.ticketUrl}" class="btn">View Ticket</a>
  `);
}

export function ticketAssignedTemplate(data: TicketEmailData): string {
  return baseTemplate(`
    <h2 style="margin-top:0">Ticket Assigned to You</h2>
    <p>You have been assigned to ticket <strong>${data.ticketNumber}</strong>.</p>
    <div class="field"><div class="label">Title</div><div class="value">${data.title}</div></div>
    <div class="field"><div class="label">Priority</div><div class="value"><span class="badge badge-${data.priority.toLowerCase()}">${data.priority}</span></div></div>
    <div class="field"><div class="label">Location</div><div class="value">${data.location}</div></div>
    ${data.asset ? `<div class="field"><div class="label">Asset</div><div class="value">${data.asset}</div></div>` : ''}
    ${data.dueDate ? `<div class="field"><div class="label">Due Date</div><div class="value">${data.dueDate}</div></div>` : ''}
    <a href="${data.ticketUrl}" class="btn">Open Ticket</a>
  `);
}

export function ticketStatusChangedTemplate(data: TicketEmailData & { changedBy: string }): string {
  return baseTemplate(`
    <h2 style="margin-top:0">Ticket Status Updated</h2>
    <p>Ticket <strong>${data.ticketNumber}</strong> status changed to <strong>${data.status}</strong> by ${data.changedBy}.</p>
    <div class="field"><div class="label">Title</div><div class="value">${data.title}</div></div>
    <div class="field"><div class="label">Current Status</div><div class="value">${data.status}</div></div>
    <a href="${data.ticketUrl}" class="btn">View Ticket</a>
  `);
}
