-- Add platform-admin identity for MegaMTX internal operators.
-- This is intentionally idempotent because some environments applied the
-- initial tenancy migration before this column was added to the baseline.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_isPlatformAdmin_idx" ON "User"("isPlatformAdmin");
