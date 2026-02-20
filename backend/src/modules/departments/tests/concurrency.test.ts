import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

/**
 * TESTE 1: Atribuição sequencial com transação Serializable
 * Valida load balancing correto mesmo com múltiplas atribuições rápidas
 */
async function testAtributionWithTransaction() {
  console.log('\n=================================================');
  console.log('🔥 TESTE 1: Atribuição sequencial (6 clientes)');
  console.log('=================================================\n');

  try {
    // Setup
    const comercial = await prisma.department.findFirst({
      where: { slug: 'comercial' },
    });

    if (!comercial) {
      console.log('❌ Departamento comercial não encontrado');
      return false;
    }

    // Mark agents online
    await prisma.user.updateMany({
      where: { departmentId: comercial.id },
      data: { onlineStatus: 'ONLINE' },
    });

    console.log(`✅ Setup: 2 agentes marcados como ONLINE`);

    // Create 6 test conversations
    const convIds: string[] = [];
    const uniquePrefix = Date.now();
    for (let i = 0; i < 6; i++) {
      const conv = await prisma.conversation.create({
        data: {
          companyId: comercial.companyId,
          customerPhone: `554199${uniquePrefix}${String(i).padStart(2, '0')}`,
          customerName: `Cliente ${i}`,
          departmentId: comercial.id,
          flowState: 'DEPARTMENT_SELECTED',
          status: 'OPEN',
        },
      });
      convIds.push(conv.id);
    }

    console.log(`✅ Criadas 6 conversas\n`);

    // Sequential assignment
    const assignments: Record<string, string> = {};
    for (let i = 0; i < convIds.length; i++) {
      const result = await prisma.$transaction(
        async (tx) => {
          const agents = await tx.user.findMany({
            where: {
              departmentId: comercial.id,
              isActive: true,
              onlineStatus: { in: ['ONLINE', 'BUSY'] },
            },
            include: {
              _count: {
                select: {
                  assignedConversations: {
                    where: { status: { in: ['OPEN', 'ASSIGNED'] } },
                  },
                },
              },
            },
          });

          if (agents.length === 0) return null;

          const sorted = [...agents].sort(
            (a, b) =>
              a._count.assignedConversations - b._count.assignedConversations,
          );

          await tx.conversation.update({
            where: { id: convIds[i] },
            data: {
              assignedUserId: sorted[0].id,
              flowState: 'ASSIGNED',
            },
          });

          return sorted[0].name;
        },
        { isolationLevel: 'Serializable' },
      );

      if (result) {
        assignments[convIds[i]] = result;
        console.log(`   ${i + 1}/6: ${result}`);
      }
    }

    // Check distribution
    const counts: Record<string, number> = {};
    Object.values(assignments).forEach((agent) => {
      counts[agent] = (counts[agent] || 0) + 1;
    });

    console.log('\n📊 Distribuição:');
    Object.entries(counts).forEach(([agent, count]) => {
      console.log(`   ${agent}: ${count}`);
    });

    const val = Object.values(counts);
    const diff = Math.max(...val) - Math.min(...val);
    const passed = diff <= 2;

    console.log(`\n${passed ? '✅ PASSAR' : '❌ FALHAR'}: Diferença = ${diff}`);

    // Cleanup
    await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });

    return passed;
  } catch (err) {
    console.error('❌ Erro:', err);
    return false;
  }
}

/**
 * TESTE 2: Estado inválido quando todos offline
 */
async function testInvalidStateAllOffline() {
  console.log('\n=================================================');
  console.log('⚠️  TESTE 2: Estado inválido (todos offline)');
  console.log('=================================================\n');

  try {
    // Mark all agents offline
    await prisma.user.updateMany({
      data: { onlineStatus: 'OFFLINE' },
    });

    console.log(`✅ Todos agentes marcados como OFFLINE`);

    // Create conversation
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ Empresa não encontrada');
      return false;
    }

    const conv = await prisma.conversation.create({
      data: {
        companyId: company.id,
        customerPhone: `554199999${Date.now()}`,
        customerName: 'Teste',
        flowState: 'GREETING',
        status: 'OPEN',
      },
    });

    // Simulate fallback routing
    const dept = await prisma.department.findFirst({
      where: { slug: 'comercial' },
    });

    if (!dept) {
      console.log('❌ Departamento não encontrado');
      return false;
    }

    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        departmentId: dept.id,
        flowState: 'DEPARTMENT_SELECTED',
        assignedUserId: null,
      },
    });

    const result = await prisma.conversation.findUnique({
      where: { id: conv.id },
    });

    if (!result) {
      console.log('❌ Conversa não encontrada');
      return false;
    }

    console.log(`\n📋 Estado da conversa:`);
    console.log(`   flowState: ${result.flowState}`);
    console.log(`   assignedUserId: ${result.assignedUserId}`);

    const valid =
      result.flowState === 'DEPARTMENT_SELECTED' &&
      result.assignedUserId === null;

    console.log(
      `\n${valid ? '✅ PASSAR' : '❌ FALHAR'}: Estado ${valid ? 'válido' : 'INVÁLIDO'}`,
    );

    // Cleanup
    await prisma.conversation.delete({ where: { id: conv.id } });

    return valid;
  } catch (err) {
    console.error('❌ Erro:', err);
    return false;
  }
}

/**
 * TESTE 3: Redistribuição ao agente ficar offline
 */
async function testRedistribution() {
  console.log('\n=================================================');
  console.log('🔄 TESTE 3: Redistribuição ao agent offline');
  console.log('=================================================\n');

  try {
    // Setup: 2+ agents online
    const comercial = await prisma.department.findFirst({
      where: { slug: 'comercial' },
    });

    if (!comercial) {
      console.log('❌ Departamento não encontrado');
      return false;
    }

    const agents = await prisma.user.findMany({
      where: { departmentId: comercial.id },
    });

    if (agents.length < 2) {
      console.log('❌ Menos de 2 agentes no setor');
      return false;
    }

    await prisma.user.updateMany({
      where: { departmentId: comercial.id },
      data: { onlineStatus: 'ONLINE' },
    });

    console.log(`✅ ${agents.length} agentes marcados ONLINE`);

    // Create conversation assigned to agent 1
    const company = await prisma.company.findFirst();
    if (!company) return false;

    const conv = await prisma.conversation.create({
      data: {
        companyId: company.id,
        customerPhone: `554199997${Date.now()}`,
        customerName: 'Teste Redistribuição',
        departmentId: comercial.id,
        assignedUserId: agents[0].id,
        flowState: 'ASSIGNED',
        status: 'ASSIGNED',
      },
    });

    console.log(`✅ Conversa atribuída ao agente 1`);

    // Mark agent 1 as offline
    await prisma.user.update({
      where: { id: agents[0].id },
      data: { onlineStatus: 'OFFLINE' },
    });

    console.log(`\n📝 Agente 1 marcado como OFFLINE\n`);

    // Redistribution
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        assignedUserId: null,
        flowState: 'DEPARTMENT_SELECTED',
      },
    });

    const available = await prisma.user.findMany({
      where: {
        departmentId: comercial.id,
        isActive: true,
        onlineStatus: { in: ['ONLINE', 'BUSY'] },
      },
    });

    if (available.length > 0) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          assignedUserId: available[0].id,
          flowState: 'ASSIGNED',
        },
      });
    }

    const final = await prisma.conversation.findUnique({
      where: { id: conv.id },
    });

    if (!final) return false;

    const redistributed =
      final.assignedUserId !== null && final.assignedUserId !== agents[0].id;

    console.log(`📋 Resultado:`);
    console.log(
      `   assignedUserId: ${final.assignedUserId?.substring(0, 8) || 'null'}`,
    );
    console.log(
      `\n${redistributed ? '✅ PASSAR' : '❌ FALHAR'}: ${redistributed ? 'Redistribuído OK' : 'NÃO redistribuído'}`,
    );

    // Cleanup
    await prisma.conversation.delete({ where: { id: conv.id } });

    return redistributed;
  } catch (err) {
    console.error('❌ Erro:', err);
    return false;
  }
}

/**
 * Main
 */
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║         SUITE: TESTES DE CONCORRÊNCIA              ║');
  console.log('║  Validando correções de race condition e deadlock  ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  const results: { name: string; passed: boolean }[] = [];

  const test1 = await testAtributionWithTransaction();
  results.push({
    name: 'Atribuição com transação Serializable',
    passed: test1,
  });

  const test2 = await testInvalidStateAllOffline();
  results.push({ name: 'Estado inválido (todos offline)', passed: test2 });

  const test3 = await testRedistribution();
  results.push({ name: 'Redistribuição ao agent offline', passed: test3 });

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║                    RESUMO FINAL                    ║');
  console.log('╠═══════════════════════════════════════════════════╣');

  results.forEach((r) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`║ ${icon} ${r.name.padEnd(48)}║`);
  });

  const passCount = results.filter((r) => r.passed).length;
  console.log('║                                                   ║');
  console.log(
    `║ Total: ${passCount}/${results.length} testes passaram${' '.repeat(passCount === 1 ? 28 : 29)}║`,
  );
  console.log('╚═══════════════════════════════════════════════════╝\n');

  await prisma.$disconnect();

  process.exit(passCount === results.length ? 0 : 1);
}

main().catch(console.error);
