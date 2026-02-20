/**
 * 🧪 Teste E2E: Roteamento Automático por Departamento
 *
 * Este teste simula o fluxo completo:
 * 1. Cliente envia mensagem via WhatsApp
 * 2. Sistema detecta a intenção (menu choice)
 * 3. Conversa é roteada para o departamento correto
 * 4. Agente disponível é atribuído
 * 5. Cliente recebe confirmação
 *
 * Execute: npm run test:e2e
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { FlowEngineService } from '../src/modules/whatsapp/flow-engine.service';
import { DepartmentRoutingService } from '../src/modules/departments/department-routing.service';
import { MessagesService } from '../src/modules/messages/messages.service';

describe('🧪 Roteamento Automático de Departamentos (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let flowEngine: FlowEngineService;
  let routing: DepartmentRoutingService;
  let messages: MessagesService;

  let company: any;
  const departments: Record<string, any> = {};
  const agents: Record<string, any> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Importar módulos conforme necessário
      ],
      providers: [PrismaService, FlowEngineService, DepartmentRoutingService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    flowEngine = moduleFixture.get<FlowEngineService>(FlowEngineService);
    routing = moduleFixture.get<DepartmentRoutingService>(
      DepartmentRoutingService,
    );

    // Setup inicial
    company = await prisma.company.findFirst({
      where: { name: { contains: 'Estearina' } },
    });

    const depts = await prisma.department.findMany({
      where: { companyId: company.id },
    });

    depts.forEach((dept: any) => {
      departments[dept.slug] = dept;
    });

    // Buscar agentes de teste
    const testAgents = await prisma.user.findMany({
      where: {
        companyId: company.id,
        role: 'AGENT',
      },
      include: { department: true },
    });

    testAgents.forEach((agent: any) => {
      if (agent.department) {
        if (!agents[agent.department.slug]) {
          agents[agent.department.slug] = [];
        }
        agents[agent.department.slug].push(agent);
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Detecção de Intenção - Menu Aliases', () => {
    it('deve detectar Laboratório nas várias formas de digitação', () => {
      const inputs = [
        '1',
        'lab',
        'LAB',
        'laboratorio',
        'LABORATORIO',
        'laboratório',
        'análise',
      ];

      inputs.forEach((input) => {
        const detected = flowEngine.processMenuChoice(input);
        expect(detected).toBe('laboratorio');
      });
    });

    it('deve detectar Administrativo nas várias formas', () => {
      const inputs = [
        '2',
        'adm',
        'ADM',
        'administrativo',
        'ADMINISTRATIVO',
        'RH',
        'rh',
      ];

      inputs.forEach((input) => {
        const detected = flowEngine.processMenuChoice(input);
        expect(detected).toBe('administrativo');
      });
    });

    it('deve detectar Comercial nas várias formas', () => {
      const inputs = [
        '3',
        'comercial',
        'COMERCIAL',
        'vendas',
        'VENDAS',
        'pedido',
        'cotação',
      ];

      inputs.forEach((input) => {
        const detected = flowEngine.processMenuChoice(input);
        expect(detected).toBe('comercial');
      });
    });

    it('deve detectar Financeiro nas várias formas', () => {
      const inputs = [
        '4',
        'financeiro',
        'FINANCEIRO',
        'boleto',
        'BOLETO',
        'nota',
        'nf',
        'pagamento',
      ];

      inputs.forEach((input) => {
        const detected = flowEngine.processMenuChoice(input);
        expect(detected).toBe('financeiro');
      });
    });

    it('deve retornar null para intenção desconhecida', () => {
      const detected = flowEngine.processMenuChoice('xyz invalid');
      expect(detected).toBeNull();
    });
  });

  describe('Roteamento para Departamentos', () => {
    it('deve rotear para Laboratório corretamente', async () => {
      // Criar conversa
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: '+5541999001001',
          customerName: 'Teste Lab',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      // Rotear para Laboratório
      const result = await routing.routeToDepartment(
        conversation.id,
        'laboratorio',
        company.id,
      );

      // Verificar
      const routed = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { department: true, assignedUser: true },
      });

      expect(routed?.department?.slug).toBe('laboratorio');
      expect(routed?.flowState).toBe('ASSIGNED');
      expect(routed?.assignedUser).toBeDefined();
      expect(routed?.assignedUser?.departmentId).toBe(
        departments.laboratorio.id,
      );
    });

    it('deve rotear para Administrativo corretamente', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: '+5541999002002',
          customerName: 'Teste Admin',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      const result = await routing.routeToDepartment(
        conversation.id,
        'administrativo',
        company.id,
      );

      const routed = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { department: true },
      });

      expect(routed?.department?.slug).toBe('administrativo');
      expect(routed?.flowState).toBe('ASSIGNED');
    });

    it('deve rotear para Comercial corretamente', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: '+5541999003003',
          customerName: 'Teste Comercial',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      const result = await routing.routeToDepartment(
        conversation.id,
        'comercial',
        company.id,
      );

      const routed = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { department: true },
      });

      expect(routed?.department?.slug).toBe('comercial');
      expect(routed?.flowState).toBe('ASSIGNED');
    });

    it('deve rotear para Financeiro corretamente', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: '+5541999004004',
          customerName: 'Teste Financeiro',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      const result = await routing.routeToDepartment(
        conversation.id,
        'financeiro',
        company.id,
      );

      const routed = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { department: true },
      });

      expect(routed?.department?.slug).toBe('financeiro');
      expect(routed?.flowState).toBe('ASSIGNED');
    });
  });

  describe('Fallback para Administrativo', () => {
    it('deve rotear para Admin quando setor offline', async () => {
      // Marcar agentes do Comercial como OFFLINE
      await prisma.user.updateMany({
        where: { departmentId: departments.comercial.id },
        data: { onlineStatus: 'OFFLINE' },
      });

      // Tentar rotear para Comercial
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: '+5541999005005',
          customerName: 'Teste Fallback',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      await routing.routeToDepartment(conversation.id, 'comercial', company.id);

      const routed = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { department: true },
      });

      // Deve ter sido roteado para Admin (root)
      expect(routed?.department?.isRoot).toBe(true);
    });
  });

  describe('Load Balancing', () => {
    it('deve distribuir conversas para agentes menos ocupados', async () => {
      // Buscar agentes do Lab
      const labAgents = await prisma.user.findMany({
        where: { departmentId: departments.laboratorio.id },
        include: { assignedConversations: true },
      });

      expect(labAgents.length).toBeGreaterThan(1);

      // Simular carga em um agente
      const agent1 = labAgents[0];
      const agent2 = labAgents[1];

      // Criar conversas para agent1
      for (let i = 0; i < 3; i++) {
        await prisma.conversation.create({
          data: {
            companyId: company.id,
            customerPhone: `+5541999010${100 + i}`,
            customerName: `Cliente ${i}`,
            status: 'ASSIGNED',
            flowState: 'ASSIGNED',
            departmentId: departments.laboratorio.id,
            assignedUserId: agent1.id,
          },
        });
      }

      // Nova conversa deve ir para agent2 (menos ocupado)
      const newConv = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: '+5541999010999',
          customerName: 'Cliente Load Balance',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      await routing.routeToDepartment(newConv.id, 'laboratorio', company.id);

      const assigned = await prisma.conversation.findUnique({
        where: { id: newConv.id },
      });

      // Verificar se foi atribuído ao agent2 (menos carregado)
      expect(assigned?.assignedUserId).toBeDefined();
      expect(assigned?.assignedUserId).toBe(agent2.id);
    });
  });

  describe('Fluxo Completo', () => {
    it('deve processar fluxo completo: saudação -> escolha -> roteamento -> atribuição', async () => {
      // 1. Cliente novo chega
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: '+5541999099099',
          customerName: 'Cliente Fluxo Completo',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      expect(conversation.flowState).toBe('GREETING');

      // 2. Enviar saudação
      await flowEngine.sendGreeting(conversation);

      // Verificar que mensagem de saudação foi criada
      const messages1 = await prisma.message.findMany({
        where: { conversationId: conversation.id },
      });

      expect(messages1.some((m) => m.isBot && m.direction === 'OUTBOUND')).toBe(
        true,
      );

      // 3. Cliente responde com menu choice "3" (Comercial)
      await prisma.message.create({
        data: {
          companyId: company.id,
          conversationId: conversation.id,
          direction: 'INBOUND',
          type: 'TEXT',
          content: '3',
          status: 'DELIVERED',
        },
      });

      // 4. Detectar intenção
      const detected = flowEngine.processMenuChoice('3');
      expect(detected).toBe('comercial');

      // 5. Rotear para departamento
      await routing.routeToDepartment(conversation.id, 'comercial', company.id);

      // 6. Verificar estado final
      const final = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { department: true, assignedUser: true },
      });

      expect(final?.flowState).toBe('ASSIGNED');
      expect(final?.status).toBe('ASSIGNED');
      expect(final?.department?.slug).toBe('comercial');
      expect(final?.assignedUser).toBeDefined();
    });
  });
});
