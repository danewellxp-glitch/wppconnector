
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🗑️  INICIANDO LIMPEZA DE DADOS (PRE-PRODUCAO)...\n');

    try {
        // 1. Delete Messages (Children of Conversation)
        console.log('1. Apagando Mensagens...');
        const deletedMessages = await prisma.message.deleteMany({});
        console.log(`   ✅ ${deletedMessages.count} mensagens removidas.`);

        // 2. Delete Assignments (Children of Conversation and User)
        console.log('2. Apagando Atribuicoes...');
        // Check if Assignment table exists (it might not be in schema depending on version, but good to try)
        try {
            // @ts-ignore
            const deletedAssignments = await prisma.assignment.deleteMany({});
            console.log(`   ✅ ${deletedAssignments.count} atribuicoes removidas.`);
        } catch (e) {
            console.log('   ⚠️ Tabela Assignment nao encontrada ou erro ao limpar (pode ignorar se nao usar).');
        }

        // 3. Delete Conversation Notes
        console.log('3. Apagando Notas Internas...');
        try {
            const deletedNotes = await prisma.conversationNote.deleteMany({});
            console.log(`   ✅ ${deletedNotes.count} notas removidas.`);
        } catch (e) {
            console.log('   ⚠️ Tabela ConversationNote nao encontrada ou erro ao limpar.');
        }

        // 4. Delete Conversations
        console.log('4. Apagando Conversas...');
        const deletedConversations = await prisma.conversation.deleteMany({});
        console.log(`   ✅ ${deletedConversations.count} conversas removidas.`);

        console.log('\n✨ LIMPEZA CONCLUIDA! O sistema esta pronto para uso real.\n');
        console.log('   • Empresas, Departamentos e Agentes FORAM MANTIDOS.');
        console.log('   • Todo o historico de conversas foi apagado.\n');

    } catch (error) {
        console.error('❌ Erro durante a limpeza:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
