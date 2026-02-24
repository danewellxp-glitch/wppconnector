import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SIM_ESTEARINA_COMPANY = {
  name: 'SIM Estearina Indústria e Comércio Ltda',
  slug: 'sim-estearina',
  phoneNumberId: 'sim-estearina-wa-phone',
  accessToken: 'sim-estearina-meta-token',
  webhookToken: 'sim-estearina-webhook-token',
};

const GREETING_MESSAGE = `Olá! 👋 Seja bem-vindo(a) à *SIM Estearina*!

Somos fabricantes de insumos oleoquímicos com mais de 20 anos de experiência. Como podemos te ajudar hoje?

Por favor, digite o *número* da área desejada:

*1️⃣ - Laboratório*
Análises, laudos técnicos, controle de qualidade e especificações de produtos.

*2️⃣ - Comercial*
Pedidos, cotações, disponibilidade de produtos e novos negócios.

*3️⃣ - Financeiro*
Boletos, notas fiscais, prazo de pagamento e questões financeiras.

*4️⃣ - Administrativo*
Demais assuntos, fornecedores, recursos humanos e informações gerais.

_Nosso horário de atendimento é de segunda a sexta, das 8h às 18h._`;

const DEPARTMENTS = [
  { slug: 'administrativo', name: 'Administrativo', isRoot: true, color: '#1E3A5F' },
  { slug: 'laboratorio', name: 'Laboratório', isRoot: false, color: '#2E86AB' },
  { slug: 'comercial', name: 'Comercial', isRoot: false, color: '#27AE60' },
  { slug: 'financeiro', name: 'Financeiro', isRoot: false, color: '#E67E22' },
];

const AGENTS = [
  { name: 'Lab Atendente 1', email: 'lab1@simestearina.com.br', department: 'laboratorio' },
  { name: 'Lab Atendente 2', email: 'lab2@simestearina.com.br', department: 'laboratorio' },
  { name: 'Comercial Atendente 1', email: 'comercial1@simestearina.com.br', department: 'comercial' },
  { name: 'Comercial Atendente 2', email: 'comercial2@simestearina.com.br', department: 'comercial' },
  { name: 'Financeiro Atendente 1', email: 'financeiro1@simestearina.com.br', department: 'financeiro' },
  { name: 'Financeiro Atendente 2', email: 'financeiro2@simestearina.com.br', department: 'financeiro' },
  { name: 'Admin Atendente 1', email: 'admin1@simestearina.com.br', department: 'administrativo' },
  { name: 'Admin Atendente 2', email: 'admin2@simestearina.com.br', department: 'administrativo' },
];

async function main() {
  try {
    console.log('\n🚀 Iniciando setup SIM Estearina...\n');

    // PASSO 1: Encontrar/Criar empresa
    console.log('📦 Processando empresa SIM Estearina...');
    let company = await prisma.company.findFirst({
      where: {
        name: SIM_ESTEARINA_COMPANY.name,
      },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: SIM_ESTEARINA_COMPANY.name,
          whatsappPhoneNumberId: SIM_ESTEARINA_COMPANY.phoneNumberId,
          whatsappAccessToken: SIM_ESTEARINA_COMPANY.accessToken,
          webhookVerifyToken: SIM_ESTEARINA_COMPANY.webhookToken,
          greetingMessage: GREETING_MESSAGE,
        },
      });
      console.log('   ✓ Empresa criada');
    } else {
      // Atualizar com a saudação se ainda não tiver
      if (!company.greetingMessage) {
        await prisma.company.update({
          where: { id: company.id },
          data: { greetingMessage: GREETING_MESSAGE },
        });
      }
      console.log('   ✓ Empresa já existe');
    }

    // PASSO 2: Departamentos
    console.log('\n📋 Processando 4 departamentos...');
    const deptMap: Record<string, string> = {};

    for (const dept of DEPARTMENTS) {
      const existing = await prisma.department.findUnique({
        where: {
          companyId_slug: { companyId: company.id, slug: dept.slug },
        },
      });

      if (!existing) {
        const created = await prisma.department.create({
          data: {
            companyId: company.id,
            slug: dept.slug,
            name: dept.name,
            isRoot: dept.isRoot,
            color: dept.color,
            responseTimeoutMinutes: 3,
            maxAgents: 2,
          },
        });
        deptMap[dept.slug] = created.id;
        console.log(`   ✓ ${dept.name} criado`);
      } else {
        deptMap[dept.slug] = existing.id;
        console.log(`   ✓ ${dept.name} já existe`);
      }
    }

    // PASSO 3: Usuários
    console.log('\n👥 Processando 8 usuários agentes...');
    const passwordHash = await bcrypt.hash('Sim@2024', 10);
    const createdUsers: Record<string, { email: string; department: string }> = {};

    for (const agent of AGENTS) {
      const existing = await prisma.user.findUnique({
        where: { email: agent.email },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            email: agent.email,
            name: agent.name,
            passwordHash,
            role: 'AGENT',
            companyId: company.id,
            departmentId: deptMap[agent.department],
            isActive: true,
          },
        });
        createdUsers[agent.email] = { email: agent.email, department: agent.department };
        console.log(`   ✓ ${agent.email} → ${agent.department}`);
      } else {
        // Se existe mas departamento está NULL, atualizar
        if (!existing.departmentId) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { departmentId: deptMap[agent.department] },
          });
        }
        console.log(`   ✓ ${agent.email} → ${agent.department} (já existe)`);
      }
    }

    // PASSO 4: Validar saudação
    console.log('\n💬 Validando mensagem de saudação...');
    const updated = await prisma.company.findUnique({
      where: { id: company.id },
    });
    if (updated?.greetingMessage) {
      console.log('   ✓ Mensagem salva no banco');
    }

    // SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('✅ Departamentos: OK (4 criados/verificados)');
    console.log('✅ Usuários: OK (8 criados/verificados)');
    AGENTS.forEach((agent) => {
      const deptName =
        agent.department === 'laboratorio' ? 'Laboratório' :
        agent.department === 'comercial' ? 'Comercial' :
        agent.department === 'financeiro' ? 'Financeiro' : 'Administrativo';
      const isRoot = agent.department === 'administrativo' ? ' (setor raiz)' : '';
      console.log(`   - ${agent.email} → ${deptName}${isRoot}`);
    });
    console.log('✅ Mensagem de saudação: salva no banco');
    console.log('✅ Setup SIM Estearina concluído!');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante setup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
