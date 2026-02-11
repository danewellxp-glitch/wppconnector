import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create company
  const company = await prisma.company.upsert({
    where: { whatsappPhoneNumberId: 'your_phone_number_id' },
    update: {},
    create: {
      name: 'Empresa Demo',
      whatsappPhoneNumberId: 'your_phone_number_id',
      whatsappAccessToken: 'your_meta_access_token',
      webhookVerifyToken: 'your_webhook_verify_token_123',
    },
  });
  console.log('Company created:', company.name);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: {
      email: 'admin@empresa.com',
      passwordHash: adminPassword,
      name: 'Administrador',
      role: 'ADMIN',
      companyId: company.id,
    },
  });
  console.log('Admin created:', admin.email);

  // Create agent users
  const agentPassword = await bcrypt.hash('agent123', 10);
  const agent1 = await prisma.user.upsert({
    where: { email: 'atendente@empresa.com' },
    update: {},
    create: {
      email: 'atendente@empresa.com',
      passwordHash: agentPassword,
      name: 'Atendente 1',
      role: 'AGENT',
      companyId: company.id,
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'atendente2@empresa.com' },
    update: {},
    create: {
      email: 'atendente2@empresa.com',
      passwordHash: agentPassword,
      name: 'Atendente 2',
      role: 'AGENT',
      companyId: company.id,
    },
  });
  console.log('Agents created');

  // --- MOCK CONVERSATIONS & MESSAGES ---

  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000);

  // Conversation 1 - Maria (active, assigned to agent1, 3 unread)
  const conv1 = await prisma.conversation.upsert({
    where: { companyId_customerPhone: { companyId: company.id, customerPhone: '5511999001001' } },
    update: {},
    create: {
      companyId: company.id,
      customerPhone: '5511999001001',
      customerName: 'Maria Silva',
      status: 'ASSIGNED',
      lastMessageAt: minutesAgo(2),
      unreadCount: 3,
    },
  });

  await prisma.assignment.deleteMany({ where: { conversationId: conv1.id } });
  await prisma.assignment.create({
    data: { conversationId: conv1.id, userId: agent1.id },
  });

  await prisma.message.deleteMany({ where: { conversationId: conv1.id } });
  await prisma.message.createMany({
    data: [
      {
        companyId: company.id,
        conversationId: conv1.id,
        direction: 'INBOUND',
        content: 'Ola, boa tarde! Gostaria de saber sobre o plano empresarial.',
        status: 'DELIVERED',
        sentAt: minutesAgo(30),
      },
      {
        companyId: company.id,
        conversationId: conv1.id,
        direction: 'OUTBOUND',
        content: 'Boa tarde, Maria! Claro, nosso plano empresarial inclui suporte 24h e ate 10 usuarios. Posso enviar mais detalhes?',
        status: 'READ',
        sentById: agent1.id,
        sentAt: minutesAgo(28),
      },
      {
        companyId: company.id,
        conversationId: conv1.id,
        direction: 'INBOUND',
        content: 'Sim, por favor! Qual o valor mensal?',
        status: 'DELIVERED',
        sentAt: minutesAgo(25),
      },
      {
        companyId: company.id,
        conversationId: conv1.id,
        direction: 'OUTBOUND',
        content: 'O plano empresarial custa R$ 299/mes. Inclui dashboard completo, relatorios e suporte prioritario.',
        status: 'READ',
        sentById: agent1.id,
        sentAt: minutesAgo(23),
      },
      {
        companyId: company.id,
        conversationId: conv1.id,
        direction: 'INBOUND',
        content: 'Interessante! Tem periodo de teste?',
        status: 'DELIVERED',
        sentAt: minutesAgo(5),
      },
      {
        companyId: company.id,
        conversationId: conv1.id,
        direction: 'INBOUND',
        content: 'E aceita cartao de credito?',
        status: 'DELIVERED',
        sentAt: minutesAgo(4),
      },
      {
        companyId: company.id,
        conversationId: conv1.id,
        direction: 'INBOUND',
        content: 'Aguardo retorno, obrigada!',
        status: 'DELIVERED',
        sentAt: minutesAgo(2),
      },
    ],
  });

  // Conversation 2 - Joao (open, unassigned, 1 unread)
  const conv2 = await prisma.conversation.upsert({
    where: { companyId_customerPhone: { companyId: company.id, customerPhone: '5511999002002' } },
    update: {},
    create: {
      companyId: company.id,
      customerPhone: '5511999002002',
      customerName: 'Joao Santos',
      status: 'OPEN',
      lastMessageAt: minutesAgo(15),
      unreadCount: 1,
    },
  });

  await prisma.message.deleteMany({ where: { conversationId: conv2.id } });
  await prisma.message.createMany({
    data: [
      {
        companyId: company.id,
        conversationId: conv2.id,
        direction: 'INBOUND',
        content: 'Boa tarde! Estou com problema no meu pedido #12345. A entrega esta atrasada.',
        status: 'DELIVERED',
        sentAt: minutesAgo(15),
      },
    ],
  });

  // Conversation 3 - Ana (assigned to agent2, resolved flow)
  const conv3 = await prisma.conversation.upsert({
    where: { companyId_customerPhone: { companyId: company.id, customerPhone: '5511999003003' } },
    update: {},
    create: {
      companyId: company.id,
      customerPhone: '5511999003003',
      customerName: 'Ana Oliveira',
      status: 'ASSIGNED',
      lastMessageAt: minutesAgo(60),
      unreadCount: 0,
    },
  });

  await prisma.assignment.deleteMany({ where: { conversationId: conv3.id } });
  await prisma.assignment.create({
    data: { conversationId: conv3.id, userId: agent2.id },
  });

  await prisma.message.deleteMany({ where: { conversationId: conv3.id } });
  await prisma.message.createMany({
    data: [
      {
        companyId: company.id,
        conversationId: conv3.id,
        direction: 'INBOUND',
        content: 'Oi! Preciso de uma segunda via do boleto.',
        status: 'DELIVERED',
        sentAt: minutesAgo(120),
      },
      {
        companyId: company.id,
        conversationId: conv3.id,
        direction: 'OUTBOUND',
        content: 'Ola Ana! Vou gerar a segunda via agora mesmo. Um momento.',
        status: 'READ',
        sentById: agent2.id,
        sentAt: minutesAgo(118),
      },
      {
        companyId: company.id,
        conversationId: conv3.id,
        direction: 'OUTBOUND',
        content: 'Pronto! Segue o link para o boleto: https://exemplo.com/boleto/abc123',
        status: 'READ',
        sentById: agent2.id,
        sentAt: minutesAgo(115),
      },
      {
        companyId: company.id,
        conversationId: conv3.id,
        direction: 'INBOUND',
        content: 'Perfeito, muito obrigada! Ja vou pagar.',
        status: 'DELIVERED',
        sentAt: minutesAgo(110),
      },
      {
        companyId: company.id,
        conversationId: conv3.id,
        direction: 'OUTBOUND',
        content: 'De nada! Qualquer duvida estamos a disposicao.',
        status: 'DELIVERED',
        sentById: agent2.id,
        sentAt: minutesAgo(60),
      },
    ],
  });

  // Conversation 4 - Carlos (open, no messages yet - just initiated)
  const conv4 = await prisma.conversation.upsert({
    where: { companyId_customerPhone: { companyId: company.id, customerPhone: '5511999004004' } },
    update: {},
    create: {
      companyId: company.id,
      customerPhone: '5511999004004',
      customerName: 'Carlos Ferreira',
      status: 'OPEN',
      lastMessageAt: minutesAgo(45),
      unreadCount: 2,
    },
  });

  await prisma.message.deleteMany({ where: { conversationId: conv4.id } });
  await prisma.message.createMany({
    data: [
      {
        companyId: company.id,
        conversationId: conv4.id,
        direction: 'INBOUND',
        content: 'Ola, quero cancelar minha assinatura.',
        status: 'DELIVERED',
        sentAt: minutesAgo(46),
      },
      {
        companyId: company.id,
        conversationId: conv4.id,
        direction: 'INBOUND',
        content: 'Meu CPF e 123.456.789-00, conta no nome de Carlos Ferreira.',
        status: 'DELIVERED',
        sentAt: minutesAgo(45),
      },
    ],
  });

  // Conversation 5 - Resolved conversation
  const conv5 = await prisma.conversation.upsert({
    where: { companyId_customerPhone: { companyId: company.id, customerPhone: '5511999005005' } },
    update: {},
    create: {
      companyId: company.id,
      customerPhone: '5511999005005',
      customerName: 'Patricia Lima',
      status: 'RESOLVED',
      lastMessageAt: minutesAgo(180),
      unreadCount: 0,
    },
  });

  await prisma.message.deleteMany({ where: { conversationId: conv5.id } });
  await prisma.message.createMany({
    data: [
      {
        companyId: company.id,
        conversationId: conv5.id,
        direction: 'INBOUND',
        content: 'Bom dia! O produto chegou certinho, muito obrigada!',
        status: 'DELIVERED',
        sentAt: minutesAgo(200),
      },
      {
        companyId: company.id,
        conversationId: conv5.id,
        direction: 'OUTBOUND',
        content: 'Que otimo, Patricia! Ficamos felizes. Se precisar de algo mais, estamos aqui!',
        status: 'READ',
        sentById: agent1.id,
        sentAt: minutesAgo(180),
      },
    ],
  });

  console.log('Mock conversations and messages created');

  console.log('\n--- Login Credentials ---');
  console.log('Admin: admin@empresa.com / admin123');
  console.log('Agent: atendente@empresa.com / agent123');
  console.log('Agent2: atendente2@empresa.com / agent123');
  console.log('-------------------------');
  console.log(`Conversations: 5 (3 active, 1 resolved, 1 open)`);
  console.log('Done!\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
