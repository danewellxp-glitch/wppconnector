/**
 * Migração: Atualiza departamentos e mensagem de boas-vindas para o novo menu de 6 opções.
 *
 * O que faz:
 *  - Renomeia 'comercial'  → slug 'vendas',       nome 'Vendas'
 *  - Renomeia 'financeiro' → slug 'compras-rose',  nome 'Compras - Rose'
 *  - Cria 'compras-thays' (Compras Thays) se não existir
 *  - Cria 'producao'       (Produção)    se não existir
 *  - Atualiza greetingMessage da empresa no banco
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register prisma/scripts/update-menu-departments.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NEW_GREETING = `Olá! 👋 Seja bem-vindo(a) à *SIM Estearina*!

Como podemos te ajudar hoje? Por favor, digite o *número* da área desejada:

*1️⃣ Laboratório*
Análises técnicas, laudos, controle de qualidade, especificações e certificados de produtos.

*2️⃣ Vendas — Thays*
Pedidos, cotações, disponibilidade de produtos, amostras, novos negócios e prazo de entrega.

*3️⃣ Compras - Rose (Manutenção)*
Boletos, notas fiscais, prazos de pagamento, conciliações e questões financeiras.

*4️⃣ Compras Thays (Insumos/Matéria Prima)*

*5️⃣ Produção*
Processo produtivo, questões técnicas de fabricação.

*6️⃣ Falar com um Atendente 👤*
Transferência direta para um atendente humano disponível.

_⏰ Nosso horário de atendimento é de segunda a sexta, das 8h às 18h._`;

async function main() {
  console.log('\n🚀 Iniciando migração de departamentos e menu...\n');

  // Buscar empresa
  const company = await prisma.company.findFirst({
    where: { name: { contains: 'SIM Estearina' } },
    include: { departments: true },
  });

  if (!company) {
    console.error('❌ Empresa SIM Estearina não encontrada no banco.');
    process.exit(1);
  }

  console.log(`✓ Empresa encontrada: ${company.name} (id: ${company.id})\n`);

  // 1. Renomear 'comercial' → 'vendas'
  const comercial = company.departments.find((d) => d.slug === 'comercial');
  if (comercial) {
    await prisma.department.update({
      where: { id: comercial.id },
      data: { slug: 'vendas', name: 'Vendas' },
    });
    console.log('✓ Departamento "comercial" renomeado para "vendas"');
  } else {
    console.log('⚠ Departamento "comercial" não encontrado (já migrado?)');
  }

  // 2. Renomear 'financeiro' → 'compras-rose'
  const financeiro = company.departments.find((d) => d.slug === 'financeiro');
  if (financeiro) {
    await prisma.department.update({
      where: { id: financeiro.id },
      data: { slug: 'compras-rose', name: 'Compras - Rose' },
    });
    console.log('✓ Departamento "financeiro" renomeado para "compras-rose"');
  } else {
    console.log('⚠ Departamento "financeiro" não encontrado (já migrado?)');
  }

  // 3. Criar 'compras-thays' se não existir
  const comprasThays = company.departments.find((d) => d.slug === 'compras-thays');
  if (!comprasThays) {
    await prisma.department.create({
      data: {
        companyId: company.id,
        slug: 'compras-thays',
        name: 'Compras Thays',
        isRoot: false,
        isActive: true,
        color: '#9B59B6',
      },
    });
    console.log('✓ Departamento "compras-thays" criado');
  } else {
    console.log('⚠ Departamento "compras-thays" já existe, pulando');
  }

  // 4. Criar 'producao' se não existir
  const producao = company.departments.find((d) => d.slug === 'producao');
  if (!producao) {
    await prisma.department.create({
      data: {
        companyId: company.id,
        slug: 'producao',
        name: 'Produção',
        isRoot: false,
        isActive: true,
        color: '#16A085',
      },
    });
    console.log('✓ Departamento "producao" criado');
  } else {
    console.log('⚠ Departamento "producao" já existe, pulando');
  }

  // 5. Atualizar greetingMessage da empresa
  await prisma.company.update({
    where: { id: company.id },
    data: { greetingMessage: NEW_GREETING },
  });
  console.log('✓ greetingMessage da empresa atualizado\n');

  // Listar departamentos finais
  const finalDepts = await prisma.department.findMany({
    where: { companyId: company.id, isActive: true },
    orderBy: { name: 'asc' },
  });

  console.log('📋 Departamentos ativos:');
  finalDepts.forEach((d) => {
    const root = d.isRoot ? ' (root)' : '';
    console.log(`   ${d.slug} — ${d.name}${root}`);
  });

  console.log('\n✅ Migração concluída com sucesso!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro na migração:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
