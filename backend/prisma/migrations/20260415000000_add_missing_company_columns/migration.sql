-- Add missing company columns that exist in schema but had no migration
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "outOfOfficeMessage" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "autoAssignEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "businessHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "businessHoursStart" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "businessHoursEnd" TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "businessDays" TEXT NOT NULL DEFAULT '1,2,3,4,5';
