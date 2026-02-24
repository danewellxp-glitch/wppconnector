import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n📊 Verificação de Setup SIM Estearina\n');

    // Get company
    const company = await prisma.company.findFirst({
      where: { name: 'SIM Estearina Indústria e Comércio Ltda' },
      include: { departments: true, users: true },
    });

    if (!company) {
      console.log('❌ Empresa não encontrada');
      process.exit(1);
    }

    console.log(`🏢 Empresa: ${company.name}`);
    console.log(`   Greeting Message: ${company.greetingMessage ? '✓ Salva' : '✗ Não salva'}`);
    console.log(`   ID: ${company.id}\n`);

    // Departments
    console.log('📋 Departamentos:');
    for (const dept of company.departments) {
      const userCount = company.users.filter((u) => u.departmentId === dept.id).length;
      console.log(
        `   • ${dept.name.padEnd(15)} (${dept.slug}) - Color: ${dept.color} - Users: ${userCount} - Root: ${dept.isRoot ? '✓' : '✗'}`
      );
    }

    // Users
    console.log('\n👥 Usuários por Departamento:');
    for (const dept of company.departments) {
      const deptUsers = company.users.filter((u) => u.departmentId === dept.id);
      if (deptUsers.length > 0) {
        console.log(`\n   ${dept.name}:`);
        for (const user of deptUsers) {
          console.log(`      • ${user.name.padEnd(25)} (${user.email})`);
          console.log(`        Ativo: ${user.isActive ? '✓' : '✗'}`);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Total: ${company.departments.length} departamentos, ${company.users.length} usuários`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
