import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting DB cleanup...');

    // Excluindo tabelas dependentes de Conversation
    await prisma.message.deleteMany();
    console.log('✔ Messages deleted');

    await prisma.conversationNote.deleteMany();
    console.log('✔ Conversation Notes deleted');

    await prisma.assignment.deleteMany();
    console.log('✔ Assignments deleted');

    // Excluindo Conversations por último
    await prisma.conversation.deleteMany();
    console.log('✔ Conversations deleted');

    console.log('Database successfully cleared for fresh testing!');
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    });
