import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { DepartmentRoutingService } from '../departments/department-routing.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

/**
 * Maps user input to department slugs.
 * Numbers match the order in the default greeting:
 *   1 - Laboratório
 *   2 - Vendas (Thays)
 *   3 - Compras - Rose (Manutenção)
 *   4 - Compras Thays (Insumos/Matéria Prima)
 *   5 - Produção
 *   6 - Falar com um Atendente (Administrativo)
 */
const MENU_ALIASES: Record<string, string> = {
  // Laboratório
  '1': 'laboratorio',
  lab: 'laboratorio',
  laboratorio: 'laboratorio',
  laudo: 'laboratorio',
  analise: 'laboratorio',
  qualidade: 'laboratorio',
  tecnico: 'laboratorio',

  // Vendas — Thays
  '2': 'vendas',
  vendas: 'vendas',
  venda: 'vendas',
  comercial: 'vendas',
  pedido: 'vendas',
  cotacao: 'vendas',
  amostra: 'vendas',
  entrega: 'vendas',
  preco: 'vendas',

  // Compras - Rose (Manutenção)
  '3': 'compras-rose',
  financeiro: 'compras-rose',
  financ: 'compras-rose',
  boleto: 'compras-rose',
  nota: 'compras-rose',
  nf: 'compras-rose',
  pagamento: 'compras-rose',
  fatura: 'compras-rose',
  cobranca: 'compras-rose',
  conciliacao: 'compras-rose',
  manutencao: 'compras-rose',

  // Compras Thays (Insumos/Matéria Prima)
  '4': 'compras-thays',
  insumo: 'compras-thays',
  insumos: 'compras-thays',
  materia: 'compras-thays',
  'materia prima': 'compras-thays',

  // Produção
  '5': 'producao',
  producao: 'producao',
  fabricacao: 'producao',
  processo: 'producao',

  // Falar com um Atendente
  '6': 'atendente',
  atendente: 'atendente',
  humano: 'atendente',
  falar: 'atendente',
  pessoa: 'atendente',
  adm: 'atendente',
  admin: 'atendente',
  administrativo: 'atendente',
  rh: 'atendente',
  'recursos humanos': 'atendente',
  fornecedor: 'atendente',
  geral: 'atendente',
};

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class FlowEngineService {
  private readonly logger = new Logger(FlowEngineService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private departmentRoutingService: DepartmentRoutingService,
    private moduleRef: ModuleRef,
  ) { }

  private getWebsocketGateway(): WebsocketGateway | null {
    try {
      return this.moduleRef.get(WebsocketGateway, { strict: false });
    } catch {
      return null;
    }
  }

  private async emitBotTyping(conversationId: string, isTyping: boolean) {
    const gateway = this.getWebsocketGateway();
    if (!gateway) return;
    gateway.emitToConversation(conversationId, 'user-typing', {
      userId: 'bot',
      userName: '🤖 Bot',
      conversationId,
      isTyping,
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  processMenuChoice(input: string): string | null {
    const key = normalizeInput(input);
    return MENU_ALIASES[key] ?? null;
  }

  /**
   * Resolve the department slug to the actual department for a given company.
   */
  async resolveDepartmentSlug(
    companyId: string,
    slug: string,
  ): Promise<{ id: string; slug: string; name: string } | null> {
    const dept = await this.prisma.department.findFirst({
      where: { companyId, slug, isActive: true },
      select: { id: true, slug: true, name: true },
    });
    if (dept) return dept;

    this.logger.warn(
      `[FLOW] No department found for slug '${slug}' in company ${companyId}`,
    );
    return null;
  }

  getDefaultGreeting(companyName: string): string {
    return (
      `Olá! 👋 Seja bem-vindo(a) à *SIM Estearina*!\n\n` +
      `Como podemos te ajudar hoje? Por favor, digite o *número* da área desejada:\n\n` +
      `*1️⃣ Laboratório*\nAnálises técnicas, laudos, controle de qualidade, especificações e certificados de produtos.\n\n` +
      `*2️⃣ Vendas — Thays*\nPedidos, cotações, disponibilidade de produtos, amostras, novos negócios e prazo de entrega.\n\n` +
      `*3️⃣ Compras - Rose (Manutenção)*\nBoletos, notas fiscais, prazos de pagamento, conciliações e questões financeiras.\n\n` +
      `*4️⃣ Compras Thays (Insumos/Matéria Prima)*\n\n` +
      `*5️⃣ Produção*\nProcesso produtivo, questões técnicas de fabricação.\n\n` +
      `*6️⃣ Falar com um Atendente 👤*\nTransferência direta para um atendente humano disponível.\n\n` +
      `_⏰ Nosso horário de atendimento é de segunda a sexta, das 8h às 18h._`
    );
  }

  isBusinessHours(company: any): boolean {
    if (!company.businessHoursEnabled) {
      return true; // Se no estiver ativado,  sempre horrio comercial
    }

    const now = new Date();
    // Converter a hora atual do servidor para UTC-3 (Horário de Brasília) para segurança
    const spTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
    );

    const day = spTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hours = spTime.getHours();
    const minutes = spTime.getMinutes();
    const currentTotalMinutes = hours * 60 + minutes;

    // Verificar se o dia atual est nos dias configurados
    const businessDays = company.businessDays?.split(',').map(Number) || [1, 2, 3, 4, 5];
    if (!businessDays.includes(day)) {
      return false;
    }

    // Verificar hora
    const startStr = company.businessHoursStart || '08:00';
    const endStr = company.businessHoursEnd || '18:00';

    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startTotal = (startH || 8) * 60 + (startM || 0);
    const endTotal = (endH || 18) * 60 + (endM || 0);

    if (currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal) {
      return true;
    }

    return false;
  }

  getOutOfHoursMessage(company: any): string {
    return company.outOfOfficeMessage?.trim() || 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.\nSua mensagem foi registrada e retornaremos o contato em nosso horário comercial. 🙏';
  }

  async sendOutOfHoursMessage(conversation: { id: string; companyId: string }) {
    const fullConv = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { company: true },
    });
    if (!fullConv) return;

    const text = this.getOutOfHoursMessage(fullConv.company);
    const meta = (fullConv.metadata as any) || {};
    const sendTo = meta.chatId || fullConv.customerPhone;

    // Emit bot typing indicator
    await this.emitBotTyping(conversation.id, true);
    await this.sleep(1200);

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      text,
      fullConv.wahaSession,
    );

    await this.prisma.message.create({
      data: {
        companyId: fullConv.companyId,
        conversationId: fullConv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: text,
        status: 'SENT',
        isBot: true,
      },
    });

    await this.emitBotTyping(conversation.id, false);
  }

  async sendGreeting(conversation: {
    id: string;
    companyId: string;
    company?: { name: string };
  }) {
    const company = await this.prisma.company.findUnique({
      where: { id: conversation.companyId },
      select: { name: true },
    });
    const text = this.getDefaultGreeting(company?.name || 'nosso atendimento');

    const fullConv = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { company: true },
    });
    if (!fullConv) return;

    const meta = (fullConv.metadata as any) || {};
    const sendTo = meta.chatId || fullConv.customerPhone;

    // Emit bot typing indicator
    await this.emitBotTyping(conversation.id, true);
    await this.sleep(1500);

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      text,
      fullConv.wahaSession,
    );

    await this.prisma.message.create({
      data: {
        companyId: fullConv.companyId,
        conversationId: fullConv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: text,
        status: 'SENT',
        isBot: true,
      },
    });

    await this.emitBotTyping(conversation.id, false);
  }

  async handleInvalidChoice(conversation: {
    id: string;
    companyId: string;
    company?: { name: string };
  }) {
    const fullConv = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { company: true },
    });
    if (!fullConv) return;

    const meta = (fullConv.metadata as any) || {};
    const sendTo = meta.chatId || fullConv.customerPhone;

    const invalidText = 'Opção inválida. Por favor escolha 1, 2, 3, 4, 5 ou 6.';
    const menuText = this.getDefaultGreeting(fullConv.company.name);

    // Emit bot typing indicator
    await this.emitBotTyping(conversation.id, true);
    await this.sleep(800);

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      invalidText,
      fullConv.wahaSession,
    );
    await this.prisma.message.create({
      data: {
        companyId: fullConv.companyId,
        conversationId: fullConv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: invalidText,
        status: 'SENT',
        isBot: true,
      },
    });

    // Brief pause before sending menu again
    await this.sleep(800);

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      menuText,
      fullConv.wahaSession,
    );
    await this.prisma.message.create({
      data: {
        companyId: fullConv.companyId,
        conversationId: fullConv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: menuText,
        status: 'SENT',
        isBot: true,
      },
    });

    await this.emitBotTyping(conversation.id, false);
  }
}
