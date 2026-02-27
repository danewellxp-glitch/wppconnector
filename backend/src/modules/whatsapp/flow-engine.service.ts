import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { DepartmentRoutingService } from '../departments/department-routing.service';

/**
 * Maps user input to department slugs.
 * Numbers match the order in the default greeting:
 *   1 - Laboratório
 *   2 - Comercial
 *   3 - Financeiro
 *   4 - Administrativo
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

  // Comercial
  '2': 'comercial',
  comercial: 'comercial',
  vendas: 'comercial',
  venda: 'comercial',
  pedido: 'comercial',
  cotacao: 'comercial',
  compra: 'comercial',
  preco: 'comercial',

  // Financeiro
  '3': 'financeiro',
  financeiro: 'financeiro',
  financ: 'financeiro',
  boleto: 'financeiro',
  nota: 'financeiro',
  nf: 'financeiro',
  pagamento: 'financeiro',
  fatura: 'financeiro',
  cobranca: 'financeiro',

  // Administrativo (root dept — fallback)
  '4': 'administrativo',
  adm: 'administrativo',
  admin: 'administrativo',
  administrativo: 'administrativo',
  rh: 'administrativo',
  'recursos humanos': 'administrativo',
  fornecedor: 'administrativo',
  geral: 'administrativo',
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
  ) { }

  processMenuChoice(input: string): string | null {
    const key = normalizeInput(input);
    return MENU_ALIASES[key] ?? null;
  }

  /**
   * Resolve the department slug to the actual department for a given company.
   * If the exact slug is not found, falls back to the root (isRoot=true) department.
   */
  async resolveDepartmentSlug(
    companyId: string,
    slug: string,
  ): Promise<{ id: string; slug: string; name: string } | null> {
    // Try exact slug match first
    const dept = await this.prisma.department.findFirst({
      where: { companyId, slug, isActive: true },
      select: { id: true, slug: true, name: true },
    });
    if (dept) return dept;

    // If slug is 'administrativo' and not found, fall back to root department
    if (slug === 'administrativo') {
      const root = await this.prisma.department.findFirst({
        where: { companyId, isRoot: true, isActive: true },
        select: { id: true, slug: true, name: true },
      });
      if (root) {
        this.logger.log(
          `[FLOW] Slug 'administrativo' not found for company ${companyId}, using root dept: ${root.name} (${root.slug})`,
        );
        return root;
      }
    }

    this.logger.warn(
      `[FLOW] No department found for slug '${slug}' in company ${companyId}`,
    );
    return null;
  }

  getDefaultGreeting(companyName: string): string {
    return (
      `Olá! 👋 Seja bem-vindo(a) à *SIM Estearina*!\n\n` +
      `Somos fabricantes de insumos oleoquímicos com mais de 20 anos de experiência. Como podemos te ajudar hoje?\n\n` +
      `Por favor, digite o *número* da área desejada:\n\n` +
      `*1️⃣ - Laboratório*\nAnálises, laudos técnicos, controle de qualidade e especificações de produtos.\n\n` +
      `*2️⃣ - Comercial*\nPedidos, cotações, disponibilidade de produtos e novos negócios.\n\n` +
      `*3️⃣ - Financeiro*\nBoletos, notas fiscais, prazo de pagamento e questões financeiras.\n\n` +
      `*4️⃣ - Administrativo*\nDemais assuntos, fornecedores, recursos humanos e informações gerais.\n\n` +
      `_Nosso horário de atendimento é de segunda a sexta, das 8h às 18h._`
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

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      text,
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

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      text,
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

    const invalidText = 'Opção inválida. Por favor escolha 1, 2, 3 ou 4.';
    const menuText = this.getDefaultGreeting(fullConv.company.name);

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      invalidText,
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

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      menuText,
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
  }
}
