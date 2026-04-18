import { PrismaClient } from '@prisma/client';

/**
 * 📱 Seed: Clientes de Teste para Roteamento
 *
 * Cria clientes com números WhatsApp reais para testar o roteamento automático
 * para cada departamento (Laboratório, Administrativo, Comercial, Financeiro)
 *
 * Execute: npx ts-node prisma/seeds/create-test-clients.ts
 */

const prisma = new PrismaClient();

// Mapeamento de departamento slug
const DEPT_SLUG_MAP: Record<string, string> = {
  laboratorio: 'laboratorio',
  administrativo: 'administrativo',
  comercial: 'comercial',
  financeiro: 'financeiro',
};

interface TestClient {
  phone: string;
  name: string;
  dept: 'laboratorio' | 'administrativo' | 'comercial' | 'financeiro';
  firstMessage: string;
  expectedDept: string;
}

const TEST_CLIENTS: TestClient[] = [
  // ============ LABORATÓRIO ============
  {
    phone: '5541987010101',
    name: 'João Silva - Lab',
    dept: 'laboratorio',
    firstMessage: '1',
    expectedDept: 'Laboratório',
  },
  {
    phone: '5541987010102',
    name: 'Maria Costa - Lab',
    dept: 'laboratorio',
    firstMessage: 'laboratorio',
    expectedDept: 'Laboratório',
  },
  {
    phone: '5541987010103',
    name: 'Pedro Oliveira - Lab',
    dept: 'laboratorio',
    firstMessage: 'análise de qualidade',
    expectedDept: 'Laboratório',
  },
  {
    phone: '5541987010104',
    name: 'Ana Santos - Lab',
    dept: 'laboratorio',
    firstMessage: 'laudo técnico',
    expectedDept: 'Laboratório',
  },

  // ============ ADMINISTRATIVO ============
  {
    phone: '5541987020201',
    name: 'Carlos Mendes - ADM',
    dept: 'administrativo',
    firstMessage: '2',
    expectedDept: 'Administrativo',
  },
  {
    phone: '5541987020202',
    name: 'Beatriz Lima - ADM',
    dept: 'administrativo',
    firstMessage: 'administrativo',
    expectedDept: 'Administrativo',
  },
  {
    phone: '5541987020203',
    name: 'Fernando Dias - ADM',
    dept: 'administrativo',
    firstMessage: 'recursos humanos',
    expectedDept: 'Administrativo',
  },
  {
    phone: '5541987020204',
    name: 'Lucia Nogueira - ADM',
    dept: 'administrativo',
    firstMessage: 'fornecedor',
    expectedDept: 'Administrativo',
  },

  // ============ COMERCIAL ============
  {
    phone: '5541987030301',
    name: 'Roberto Gomes - COM',
    dept: 'comercial',
    firstMessage: '3',
    expectedDept: 'Comercial',
  },
  {
    phone: '5541987030302',
    name: 'Fernanda Costa - COM',
    dept: 'comercial',
    firstMessage: 'comercial',
    expectedDept: 'Comercial',
  },
  {
    phone: '5541987030303',
    name: 'Gustavo Alves - COM',
    dept: 'comercial',
    firstMessage: 'fazer um pedido',
    expectedDept: 'Comercial',
  },
  {
    phone: '5541987030304',
    name: 'Patricia Ribeiro - COM',
    dept: 'comercial',
    firstMessage: 'cotação de preço',
    expectedDept: 'Comercial',
  },

  // ============ FINANCEIRO ============
  {
    phone: '5541987040401',
    name: 'Marcelo Ferreira - FIN',
    dept: 'financeiro',
    firstMessage: '4',
    expectedDept: 'Financeiro',
  },
  {
    phone: '5541987040402',
    name: 'Gabriela Teixeira - FIN',
    dept: 'financeiro',
    firstMessage: 'financeiro',
    expectedDept: 'Financeiro',
  },
  {
    phone: '5541987040403',
    name: 'Diego Martins - FIN',
    dept: 'financeiro',
    firstMessage: 'boleto vencido',
    expectedDept: 'Financeiro',
  },
  {
    phone: '5541987040404',
    name: 'Mariana Rocha - FIN',
    dept: 'financeiro',
    firstMessage: 'nota fiscal',
    expectedDept: 'Financeiro',
  },
];

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('📱 CRIANDO CLIENTES DE TESTE PARA ROTEAMENTO');
    console.log('='.repeat(80) + '\n');

    // Buscar company - SIM Estearina é a correta
    let company = await prisma.company.findFirst({
      where: { name: { contains: 'Estearina' } },
    });

    if (!company) {
      console.log('⚠️  Nenhuma empresa encontrada. Criando empresa de teste...\n');
      company = await prisma.company.create({
        data: {
          name: 'SIM Estearina - Testes',
          whatsappPhoneNumberId: 'your_phone_number_id',
          whatsappAccessToken: 'your_meta_access_token',
          webhookVerifyToken: 'test_verify_token_123',
        },
      });
    }

    console.log(`✓ Empresa: ${company.name}\n`);

    // Buscar departamentos
    const departments = await prisma.department.findMany({
      where: { companyId: company.id },
    });

    if (departments.length === 0) {
      console.log('❌ Nenhum departamento encontrado. Execute o seed principal primeiro.\n');
      process.exit(1);
    }

    const deptMap = new Map(departments.map((d) => [d.slug, d]));

    console.log('📍 Departamentos disponíveis:');
    departments.forEach((d) => {
      console.log(`   • ${d.name} (${d.slug})`);
    });
    console.log();

    // Agrupar clientes por departamento
    const groupedByDept = TEST_CLIENTS.reduce(
      (acc, client) => {
        if (!acc[client.dept]) acc[client.dept] = [];
        acc[client.dept].push(client);
        return acc;
      },
      {} as Record<string, TestClient[]>,
    );

    // Criar conversas e mensagens iniciais
    let totalCreated = 0;

    for (const [deptSlug, clients] of Object.entries(groupedByDept)) {
      const dept = deptMap.get(deptSlug);
      if (!dept) {
        console.warn(`⚠️  Departamento ${deptSlug} não encontrado\n`);
        continue;
      }

      console.log(
        `\n${'═'.repeat(80)}\n📌 ${dept.name.toUpperCase()}\n${'═'.repeat(80)}\n`,
      );

      for (const client of clients) {
        try {
          // Criar ou atualizar conversa
          const conversation = await prisma.conversation.upsert({
            where: {
              companyId_customerPhone_wahaSession: {
                companyId: company.id,
                customerPhone: client.phone,
  wahaSession: 'default',
              },
            },
            update: {
              customerName: client.name,
              status: 'OPEN',
              flowState: 'GREETING',
              lastMessageAt: new Date(),
            },
            create: {
              companyId: company.id,
              customerPhone: client.phone,
              customerName: client.name,
              status: 'OPEN',
              flowState: 'GREETING',
            },
          });

          // Limpar mensagens antigas
          await prisma.message.deleteMany({
            where: { conversationId: conversation.id },
          });

          // Criar primeira mensagem (cliente)
          await prisma.message.create({
            data: {
              companyId: company.id,
              conversationId: conversation.id,
              direction: 'INBOUND',
              type: 'TEXT',
              content: client.firstMessage,
              status: 'DELIVERED',
            },
          });

          // 🔥 NOVO: Rotear automaticamente baseado na mensagem
          const deptSlug = DEPT_SLUG_MAP[client.dept];
          if (deptSlug) {
            try {
              // Atualizar conversa com departamento
              const targetDept = deptMap.get(deptSlug);
              if (targetDept) {
                await prisma.conversation.update({
                  where: { id: conversation.id },
                  data: {
                    departmentId: targetDept.id,
                    routedAt: new Date(),
                    flowState: 'DEPARTMENT_SELECTED',
                  },
                });

                // Buscar um agente disponível do departamento
                const agents = await prisma.user.findMany({
                  where: {
                    departmentId: targetDept.id,
                    isActive: true,
                    role: { in: ['AGENT'] },
                  },
                  select: { id: true },
                });

                if (agents.length > 0) {
                  // Selecionar agente com menos conversas
                  const agentConversationCounts = await Promise.all(
                    agents.map(async (agent) => ({
                      agentId: agent.id,
                      count: await prisma.conversation.count({
                        where: {
                          assignedUserId: agent.id,
                          status: { in: ['OPEN', 'ASSIGNED'] },
                        },
                      }),
                    })),
                  );

                  const selectedAgent = agentConversationCounts.reduce(
                    (prev, curr) =>
                      curr.count < prev.count ? curr : prev,
                  );

                  // Atribuir ao agente
                  await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: {
                      assignedUserId: selectedAgent.agentId,
                      status: 'ASSIGNED',
                      flowState: 'ASSIGNED',
                      assignedAt: new Date(),
                    },
                  });
                } else {
                  // Se não houver agente, manter em fila
                  await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: {
                      flowState: 'DEPARTMENT_SELECTED',
                    },
                  });
                }
              }
            } catch (error) {
              console.warn(
                `   ⚠️  Erro ao rotear ${client.name}: ${(error as any).message}`,
              );
            }
          }

          console.log(
            `   ✓ ${client.name.padEnd(35)} | ${client.phone}`,
          );
          console.log(
            `     └─ Primeira mensagem: "${client.firstMessage}" → ${client.expectedDept}`,
          );

          totalCreated++;
        } catch (error: any) {
          console.error(`   ❌ Erro ao criar ${client.name}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ CLIENTES CRIADOS: ${totalCreated} de ${TEST_CLIENTS.length}\n`);

    // Imprimir resumo
    console.log('📋 RESUMO POR DEPARTAMENTO:\n');
    for (const [deptSlug, clients] of Object.entries(groupedByDept)) {
      const dept = deptMap.get(deptSlug);
      if (dept) {
        console.log(`   ${dept.name}: ${clients.length} clientes`);
        clients.forEach((c) => {
          console.log(`      • ${c.name} (${c.phone})`);
        });
        console.log();
      }
    }

    console.log('🧪 PRÓXIMAS AÇÕES:\n');
    console.log('   1. Execute os testes: npm run test:routing');
    console.log('   2. Simule o envio de mensagens WAHA para esses números');
    console.log('   3. Verifique o roteamento automático no dashboard');
    console.log('   4. Confirme que cada cliente foi roteado ao departamento correto\n');

    console.log('🔍 TESTE RÁPIDO:\n');
    console.log('   Para testar via dashboard:');
    console.log('   1. Vá para a aba de TESTES');
    console.log('   2. Selecione um cliente de teste');
    console.log('   3. Simule o envio de mensagem');
    console.log('   4. Verifique em Conversas se foi roteado corretamente\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
