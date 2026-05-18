-- Replace Twilio SMS with Firebase Cloud Messaging push notifications
-- Removes: SmsLog, PhoneVerification tables; phone/phoneVerified/phoneVerifiedAt columns
-- Adds: PushLog table; push preference columns; WEB platform enum value
-- Renames: SubscriptionPlan.allowSms -> allowPush

-- Add WEB to DevicePlatform enum
ALTER TYPE "DevicePlatform" ADD VALUE IF NOT EXISTS 'WEB';

-- Rename allowSms -> allowPush in SubscriptionPlan
ALTER TABLE "SubscriptionPlan" RENAME COLUMN "allowSms" TO "allowPush";

-- Remove phone/verification columns from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneVerified";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneVerifiedAt";

-- Remove SMS preference columns from NotificationPreference
ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "smsEnabled";
ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "onAssignSms";
ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "onStatusSms";
ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "onCommentSms";

-- Add push preference columns to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "pushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "onAssignPush" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "onStatusPush" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "onCommentPush" BOOLEAN NOT NULL DEFAULT true;

-- Drop SMS-related tables (PhoneVerification has FK to User)
DROP TABLE IF EXISTS "PhoneVerification";
DROP TABLE IF EXISTS "SmsLog";

-- Create PushLog table
CREATE TABLE IF NOT EXISTS "PushLog" (
    "id"                TEXT         NOT NULL,
    "organizationId"    TEXT,
    "userId"            TEXT,
    "ticketId"          TEXT,
    "deviceTokenId"     TEXT,
    "templateName"      TEXT,
    "title"             TEXT         NOT NULL,
    "body"              TEXT         NOT NULL,
    "status"            TEXT         NOT NULL,
    "errorMessage"      TEXT,
    "provider"          TEXT         NOT NULL DEFAULT 'fcm',
    "providerMessageId" TEXT,
    "sentAt"            TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PushLog_organizationId_idx" ON "PushLog"("organizationId");
CREATE INDEX IF NOT EXISTS "PushLog_userId_idx"         ON "PushLog"("userId");
CREATE INDEX IF NOT EXISTS "PushLog_ticketId_idx"       ON "PushLog"("ticketId");
CREATE INDEX IF NOT EXISTS "PushLog_status_idx"         ON "PushLog"("status");
CREATE INDEX IF NOT EXISTS "PushLog_createdAt_idx"      ON "PushLog"("createdAt");

ALTER TABLE "PushLog" ADD CONSTRAINT "PushLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PushLog" ADD CONSTRAINT "PushLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PushLog" ADD CONSTRAINT "PushLog_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
