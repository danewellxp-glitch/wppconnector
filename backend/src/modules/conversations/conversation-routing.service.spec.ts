import { ConversationRoutingService } from './conversation-routing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ModuleRef } from '@nestjs/core';

describe('ConversationRoutingService', () => {
  let service: ConversationRoutingService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockWhatsappService: jest.Mocked<WhatsappService>;
  let mockNotifications: jest.Mocked<NotificationsService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;

  const mockConversation = {
    id: 'conv-123',
    customerPhone: '+5511999999999',
    customerName: 'João Silva',
    companyId: 'company-123',
    departmentId: 'dept-456',
    flowState: 'GREETING',
    lastDepartmentId: 'dept-789',
    lastAttendantId: 'agent-001',
    lastAttendedAt: new Date('2026-02-18'),
  };

  beforeEach(() => {
    // Criar mocks manualmente
    mockPrisma = {
      conversation: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      message: {
        create: jest.fn(),
      },
    } as any;

    mockWhatsappService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockNotifications = {
      notifyAudit: jest.fn(),
    } as any;

    mockModuleRef = {
      get: jest.fn(),
    } as any;

    // Criar instância do serviço com mocks
    service = new ConversationRoutingService(
      mockPrisma,
      mockWhatsappService,
      mockNotifications,
      mockModuleRef,
    );
  });

  describe('checkAndSuggestPreviousRouting', () => {
    it('deve retornar false se não houver conversa anterior', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.checkAndSuggestPreviousRouting(
        'conv-123',
        '+5511999999999',
        'company-123',
      );

      expect(result).toBe(false);
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalled();
    });

    it('deve buscar conversa anterior pelo número de telefone', async () => {
      mockPrisma.conversation.findFirst = jest.fn().mockResolvedValue(null);

      await service.checkAndSuggestPreviousRouting(
        'conv-123',
        '+5511999999999',
        'company-123',
      );

      expect(mockPrisma.conversation.findFirst).toHaveBeenCalled();
    });
  });

  describe('handleRoutingSuggestionResponse', () => {
    it('deve processar respostas', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue({
        ...mockConversation,
        lastDepartmentId: 'dept-789',
      });

      const result = await service.handleRoutingSuggestionResponse(
        'conv-123',
        'SIM',
      );

      expect(result).toBeDefined();
      expect(result.accepted).toBeDefined();
    });

    it('deve rejeitar respostas negativas', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(
        mockConversation,
      );

      const result = await service.handleRoutingSuggestionResponse(
        'conv-123',
        'NÃO',
      );

      expect(result.accepted).toBe(false);
    });

    it('deve retornar false para respostas inválidas', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(
        mockConversation,
      );

      const result = await service.handleRoutingSuggestionResponse(
        'conv-123',
        'talvez',
      );

      expect(result.accepted).toBe(false);
    });
  });

  describe('recordAttendance', () => {
    it('deve registrar dados do atendimento', async () => {
      mockPrisma.conversation.findUnique = jest.fn().mockResolvedValue(mockConversation);
      mockPrisma.conversation.update = jest.fn().mockResolvedValue({
        ...mockConversation,
        lastDepartmentId: 'dept-456',
        lastAttendantId: 'agent-001',
      });

      await service.recordAttendance('conv-123', 'dept-456', 'agent-001');

      // Método executado sem erros
      expect(mockPrisma.conversation.update).toHaveBeenCalled();
    });
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  it('deve ter todos os métodos necessários', () => {
    expect(service.checkAndSuggestPreviousRouting).toBeDefined();
    expect(service.handleRoutingSuggestionResponse).toBeDefined();
    expect(service.recordAttendance).toBeDefined();
  });
});
