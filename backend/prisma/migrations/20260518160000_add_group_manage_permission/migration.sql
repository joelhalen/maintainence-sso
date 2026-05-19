-- Align Permission enum with schema (groups feature)
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'GROUP_MANAGE';
