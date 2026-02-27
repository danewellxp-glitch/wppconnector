const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Clearing database conversations...');

    // Try to use a transaction for safety
    await prisma.$transaction(async (tx) => {
        // Delete messages first (due to foreign key constraints to conversation)
        const deletedMessages = await tx.message.deleteMany({});
        console.log(`Deleted ${deletedMessages.count} messages.`);

        // Delete assignments (due to foreign key constraints to conversation)
        const deletedAssignments = await tx.assignment.deleteMany({});
        console.log(`Deleted ${deletedAssignments.count} assignments.`);

        // Delete notes (due to foreign key constraints to conversation)
        const deletedNotes = await tx.conversationNote.deleteMany({});
        console.log(`Deleted ${deletedNotes.count} notes.`);

        // Delete conversations
        const deletedConversations = await tx.conversation.deleteMany({});
        console.log(`Deleted ${deletedConversations.count} conversations.`);
    });

    console.log('Database cleared successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
