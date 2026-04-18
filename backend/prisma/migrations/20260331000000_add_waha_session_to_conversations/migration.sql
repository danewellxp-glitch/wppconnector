-- Add wahaSession column with default 'default' so all existing rows are safely populated
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "wahaSession" TEXT NOT NULL DEFAULT 'default';

-- Drop old unique constraint (companyId, customerPhone) if it exists
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_companyId_customerPhone_key";

-- Add new unique constraint (companyId, customerPhone, wahaSession)
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_companyId_customerPhone_wahaSession_key" UNIQUE ("companyId", "customerPhone", "wahaSession");
