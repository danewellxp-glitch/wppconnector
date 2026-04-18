-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InternalChatType" AS ENUM ('DIRECT', 'GROUP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InternalMemberRole" AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InternalMessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "internal_chats" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "InternalChatType" NOT NULL DEFAULT 'DIRECT',
    "name" TEXT,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "internal_chat_members" (
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "InternalMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "internal_chat_members_pkey" PRIMARY KEY ("chatId", "userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "internal_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "InternalMessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "internal_chats_companyId_updatedAt_idx" ON "internal_chats"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "internal_chat_members_userId_idx" ON "internal_chat_members"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "internal_messages_chatId_createdAt_idx" ON "internal_messages"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "internal_chats" DROP CONSTRAINT IF EXISTS "internal_chats_companyId_fkey";
ALTER TABLE "internal_chats" ADD CONSTRAINT "internal_chats_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_chats" DROP CONSTRAINT IF EXISTS "internal_chats_createdById_fkey";
ALTER TABLE "internal_chats" ADD CONSTRAINT "internal_chats_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_chat_members" DROP CONSTRAINT IF EXISTS "internal_chat_members_chatId_fkey";
ALTER TABLE "internal_chat_members" ADD CONSTRAINT "internal_chat_members_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "internal_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "internal_chat_members" DROP CONSTRAINT IF EXISTS "internal_chat_members_userId_fkey";
ALTER TABLE "internal_chat_members" ADD CONSTRAINT "internal_chat_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "internal_messages" DROP CONSTRAINT IF EXISTS "internal_messages_chatId_fkey";
ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "internal_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "internal_messages" DROP CONSTRAINT IF EXISTS "internal_messages_senderId_fkey";
ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_messages" DROP CONSTRAINT IF EXISTS "internal_messages_replyToId_fkey";
ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "internal_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
