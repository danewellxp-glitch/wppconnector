import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n📱 CRIANDO EMPRESA SIM ESTEARINA COM AGENTES...\n');

    // Criar ou buscar empresa
    let company = await prisma.company.findFirst({
      where: { name: { contains: 'Estearina' } },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'SIM Estearina Indústria e Comércio Ltda',
          whatsappPhoneNumberId: 'your_phone_number_id',
          whatsappAccessToken: 'your_meta_access_token',
          webhookVerifyToken: 'test_verify_token_123',
        },
      });
      console.log(`✅ Empresa criada: ${company.name}\n`);
    } else {
      console.log(`✅ Empresa encontrada: ${company.name}\n`);
    }

    // Criar departamentos
    const depts = [
      { name: 'Laboratório', slug: 'laboratorio' },
      { name: 'Administrativo', slug: 'administrativo' },
      { name: 'Comercial', slug: 'comercial' },
      { name: 'Financeiro', slug: 'financeiro' },
    ];

    console.log('📍 Criando departamentos...\n');

    const departments: Record<string, string> = {};

    for (const dept of depts) {
      const existing = await prisma.department.findFirst({
        where: { companyId: company.id, slug: dept.slug },
      });

      if (existing) {
        departments[dept.slug] = existing.id;
        console.log(`   ✓ ${dept.name} (já existe)`);
      } else {
        const created = await prisma.department.create({
          data: {
            companyId: company.id,
            name: dept.name,
            slug: dept.slug,
            description: `Departamento de ${dept.name}`,
            isActive: true,
            maxAgents: 10,
          },
        });
        departments[dept.slug] = created.id;
        console.log(`   ✓ ${dept.name} criado`);
      }
    }

    // Criar agentes
    const agentPassword = await bcrypt.hash('Sim@2024', 10);

    const agents = [
      { name: 'Lab Atendente 1', email: 'lab1@simestearina.com.br', dept: 'laboratorio' },
      { name: 'Lab Atendente 2', email: 'lab2@simestearina.com.br', dept: 'laboratorio' },
      {
        name: 'Admin Atendente 1',
        email: 'admin1@simestearina.com.br',
        dept: 'administrativo',
      },
      {
        name: 'Admin Atendente 2',
        email: 'admin2@simestearina.com.br',
        dept: 'administrativo',
      },
      {
        name: 'Comercial Atendente 1',
        email: 'comercial1@simestearina.com.br',
        dept: 'comercial',
      },
      {
        name: 'Comercial Atendente 2',
        email: 'comercial2@simestearina.com.br',
        dept: 'comercial',
      },
      {
        name: 'Financeiro Atendente 1',
        email: 'financeiro1@simestearina.com.br',
        dept: 'financeiro',
      },
      {
        name: 'Financeiro Atendente 2',
        email: 'financeiro2@simestearina.com.br',
        dept: 'financeiro',
      },
    ];

    console.log('\n👥 Criando agentes...\n');

    for (const agent of agents) {
      const existing = await prisma.user.findFirst({
        where: { email: agent.email },
      });

      if (existing) {
        console.log(`   ✓ ${agent.name} (${agent.email}) - já existe`);
      } else {
        await prisma.user.create({
          data: {
            email: agent.email,
            passwordHash: agentPassword,
            name: agent.name,
            role: 'AGENT',
            companyId: company.id,
            departmentId: departments[agent.dept],
            isActive: true,
          },
        });
        console.log(`   ✓ ${agent.name} (${agent.email}) criado`);
      }
    }

    console.log('\n✅ SIM Estearina configurada com sucesso!\n');
    console.log('📊 Resumo:');
    console.log(`   • Empresa: ${company.name}`);
    console.log(`   • Departamentos: ${depts.length}`);
    console.log(`   • Agentes: ${agents.length}`);
    console.log(`\n✅ Pronto para criar clientes de teste!\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
