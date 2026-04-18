-- Remove timeout feature: timeoutAt from conversations, responseTimeoutMinutes from departments
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "timeoutAt";
ALTER TABLE "departments" DROP COLUMN IF EXISTS "responseTimeoutMinutes";
