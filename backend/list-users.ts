import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      department: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          isRoot: true,
        },
      },
    },
    orderBy: [
      { role: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  console.log('\n' + '='.repeat(120));
  console.log('📋 TODOS OS USUÁRIOS DO SISTEMA');
  console.log('='.repeat(120) + '\n');

  if (users.length === 0) {
    console.log('❌ Nenhum usuário encontrado');
    return;
  }

  users.forEach((user, index) => {
    const roleEmoji = user.role === 'ADMIN' ? '👑' : '👤';
    const activeEmoji = user.isActive ? '✅' : '❌';

    console.log(`${index + 1}. ${roleEmoji} ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Departamento: ${user.department?.name || '(Sem departamento)'} ${user.department?.isRoot ? ' [ROOT]' : ''}`);
    console.log(`   Ativo: ${activeEmoji} ${user.isActive ? 'Sim' : 'Não'}`);
    console.log(`   Criado em: ${new Date(user.createdAt).toLocaleString('pt-BR')}`);
    console.log('');
  });

  console.log('='.repeat(120));
  console.log(`✅ Total: ${users.length} usuário(s)`);
  console.log('='.repeat(120) + '\n');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
