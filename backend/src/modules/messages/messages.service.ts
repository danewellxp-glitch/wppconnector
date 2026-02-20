import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { join } from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private moduleRef: ModuleRef,
  ) {}

  private getWebsocketGateway(): WebsocketGateway | null {
    try {
      return this.moduleRef.get(WebsocketGateway, { strict: false });
    } catch (error) {
      return null;
    }
  }

  async sendMessage(
    userId: string,
    companyId: string,
    dto: SendMessageDto,
    agentName?: string,
  ) {
    // Get conversation to find customer phone
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { company: true },
    });

    if (!conversation) {
      throw new Error('Conversa nao encontrada');
    }

    // Save message in DB as PENDING (original content without agent prefix)
    const message = await this.prisma.message.create({
      data: {
        companyId,
        conversationId: dto.conversationId,
        direction: 'OUTBOUND',
        type: dto.type || 'TEXT',
        content: dto.content,
        status: 'PENDING',
        sentById: userId,
      },
      include: {
        sentBy: { select: { id: true, name: true } },
      },
    });

    // Fetch agent's department name to build '*Nome - Setor*:' prefix
    let agentPrefix = agentName || null;
    if (agentName) {
      const agentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { department: { select: { name: true } } },
      });
      if (agentUser?.department?.name) {
        agentPrefix = `${agentName} - ${agentUser.department.name}`;
      }
    }

    // Build WhatsApp text with agent name+department prefix
    const whatsappText = agentPrefix
      ? `*${agentPrefix}*: ${dto.content}`
      : dto.content;

    // Use chatId from metadata (LID) for WAHA, fallback to customerPhone
    const meta = conversation.metadata as any;
    const sendTo = meta?.chatId || conversation.customerPhone;

    // Send via WhatsApp
    try {
      const waResponse = await this.whatsappService.sendTextMessage(
        conversation.company.whatsappAccessToken,
        conversation.company.whatsappPhoneNumberId,
        sendTo,
        whatsappText,
      );

      const waMessageId = waResponse.messages?.[0]?.id || null;
      this.logger.log(
        `Message sent for conversation ${dto.conversationId}, waId: ${waMessageId}`,
      );

      const updatedMessage = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          ...(waMessageId && { whatsappMessageId: waMessageId }),
          status: 'SENT',
        },
        include: {
          sentBy: { select: { id: true, name: true } },
        },
      });

      await this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: new Date() },
      });

      const gateway = this.getWebsocketGateway();
      if (gateway) {
        gateway.emitToConversation(
          dto.conversationId,
          'message-sent',
          updatedMessage,
        );
      }

      return updatedMessage;
    } catch (error: any) {
      this.logger.error(
        `Failed to send WhatsApp message: ${error.message}`,
        error.response?.data || error.stack,
      );

      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  /**
   * Find or create a conversation by companyId and customerPhone (and optionally chatId).
   * Does not create any message. Used by flow engine to decide greeting vs normal handling.
   */
  async findOrCreateConversation(
    companyId: string,
    customerPhone: string,
    customerName?: string,
    chatId?: string,
    contactProfile?: {
      pushname?: string;
      name?: string;
      isBusiness?: boolean;
      profilePictureURL?: string;
    },
  ) {
    let conversation = await this.prisma.conversation.findUnique({
      where: { companyId_customerPhone: { companyId, customerPhone } },
    });
    if (!conversation && chatId && chatId !== customerPhone) {
      conversation = await this.prisma.conversation.findUnique({
        where: {
          companyId_customerPhone: { companyId, customerPhone: chatId },
        },
      });
      if (conversation) {
        conversation = await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            customerPhone,
            metadata: {
              ...(conversation.metadata as any),
              chatId,
              ...(contactProfile || {}),
            },
          },
        });
      }
    }
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId,
          customerPhone,
          customerName: customerName || null,
          status: 'OPEN',
          metadata: {
            ...(chatId && { chatId }),
            ...(contactProfile || {}),
          },
        },
      });
    }
    return conversation;
  }

  async handleIncomingMessage(
    companyId: string,
    customerPhone: string,
    whatsappMessageId: string,
    content: string,
    type: string,
    customerName?: string,
    mediaUrl?: string,
    chatId?: string,
    contactProfile?: {
      pushname?: string;
      name?: string;
      isBusiness?: boolean;
      profilePictureURL?: string;
    },
  ) {
    // Check for duplicate (idempotency)
    const existing = await this.prisma.message.findUnique({
      where: { whatsappMessageId },
    });

    if (existing) {
      this.logger.warn(`Duplicate message ignored: ${whatsappMessageId}`);
      return existing;
    }

    // Find conversation by real phone number first, then try chatId (backward compat)
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        companyId_customerPhone: { companyId, customerPhone },
      },
    });

    // If not found by real phone, try finding by chatId (old LID-stored conversations)
    if (!conversation && chatId && chatId !== customerPhone) {
      conversation = await this.prisma.conversation.findUnique({
        where: {
          companyId_customerPhone: { companyId, customerPhone: chatId },
        },
      });

      // Migrate: update old LID-based customerPhone to real number
      if (conversation) {
        this.logger.log(
          `Migrating conversation ${conversation.id}: ${chatId} → ${customerPhone}`,
        );
        conversation = await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            customerPhone,
            metadata: {
              ...(conversation.metadata as any),
              chatId,
              ...(contactProfile || {}),
            },
          },
        });
      }
    }

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId,
          customerPhone,
          customerName: customerName || null,
          status: 'OPEN',
          metadata: {
            ...(chatId && { chatId }),
            ...(contactProfile || {}),
          },
        },
      });
    }

    // Save incoming message
    const message = await this.prisma.message.create({
      data: {
        companyId,
        conversationId: conversation.id,
        whatsappMessageId,
        direction: 'INBOUND',
        type: (type?.toUpperCase() as any) || 'TEXT',
        content,
        mediaUrl: mediaUrl || null,
        status: 'DELIVERED',
      },
    });

    // Auto-capture customer name from message content
    const extractedName =
      type === 'TEXT' ? this.extractNameFromMessage(content) : null;

    // Build conversation update
    const conversationUpdate: any = {
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
      ...(conversation.status === 'RESOLVED' && { status: 'OPEN' }),
    };

    // Update name: extracted from chat > webhook customerName > existing
    const nameToSet = extractedName || customerName;
    if (nameToSet && nameToSet !== conversation.customerName) {
      conversationUpdate.customerName = nameToSet;
    }

    // Update metadata with chatId and profile if new info available
    if (chatId || contactProfile) {
      const existingMeta = (conversation.metadata as any) || {};
      conversationUpdate.metadata = {
        ...existingMeta,
        ...(chatId && { chatId }),
        ...(contactProfile || {}),
      };
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: conversationUpdate,
    });

    // Emit to WebSocket: by department if routed, else company
    const gateway = this.getWebsocketGateway();
    if (gateway) {
      if (conversation.departmentId) {
        gateway.emitToDepartment(
          conversation.departmentId,
          'message-received',
          {
            message,
            conversationId: conversation.id,
          },
        );
      } else {
        gateway.emitToCompany(companyId, 'message-received', {
          message,
          conversationId: conversation.id,
        });
      }
    }

    return message;
  }

  /**
   * Extract customer name from message using common Portuguese patterns.
   */
  private extractNameFromMessage(content: string): string | null {
    const patterns = [
      /\bmeu nome (?:e|é)\s+(.+)/i,
      /\bme chamo\s+(.+)/i,
      /\bsou (?:o|a)\s+(.+)/i,
      /\bpode me chamar de\s+(.+)/i,
      /\bnome:\s*(.+)/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match?.[1]) {
        // Clean: take first 2-3 words, remove punctuation
        const name = match[1]
          .trim()
          .split(/[,.\n!?]/)[0]
          .trim()
          .split(/\s+/)
          .slice(0, 3)
          .join(' ');
        if (name.length >= 2 && name.length <= 60) {
          return name;
        }
      }
    }
    return null;
  }

  async sendMedia(
    userId: string,
    companyId: string,
    conversationId: string,
    fileBuffer: Buffer,
    filename: string,
    agentName?: string,
    caption?: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { company: true },
    });
    if (!conversation) throw new Error('Conversa nao encontrada');

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const audioExts = ['mp3', 'ogg', 'wav', 'webm'];

    let type: 'DOCUMENT' | 'IMAGE' | 'AUDIO' = 'DOCUMENT';
    if (imageExts.includes(ext)) type = 'IMAGE';
    else if (audioExts.includes(ext)) type = 'AUDIO';

    const messageContent = caption || filename;

    const message = await this.prisma.message.create({
      data: {
        companyId,
        conversationId,
        direction: 'OUTBOUND',
        type,
        content: messageContent,
        status: 'PENDING',
        sentById: userId,
      },
      include: { sentBy: { select: { id: true, name: true } } },
    });

    const base64Data = fileBuffer.toString('base64');
    const meta = conversation.metadata as any;
    const sendTo = meta?.chatId || conversation.customerPhone;

    try {
      const uniqueFilename = `${randomUUID()}.${ext || 'bin'}`;
      const uploadsDir = join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir))
        fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(join(uploadsDir, uniqueFilename), fileBuffer);
      const backendUrl =
        process.env.BACKEND_URL || 'http://192.168.10.156:4000';
      const mediaUrl = `${backendUrl}/uploads/${uniqueFilename}`;

      const waResponse = await this.whatsappService.sendMediaMessage(
        conversation.company.whatsappAccessToken,
        conversation.company.whatsappPhoneNumberId,
        sendTo,
        base64Data,
        filename,
        agentName ? `*${agentName}*: ${caption || ''}` : caption,
      );

      const waMessageId = waResponse.messages?.[0]?.id || null;

      const updatedMessage = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          ...(waMessageId && { whatsappMessageId: waMessageId }),
          status: 'SENT',
          mediaUrl,
        },
        include: { sentBy: { select: { id: true, name: true } } },
      });

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      const gateway = this.getWebsocketGateway();
      if (gateway) {
        gateway.emitToConversation(
          conversationId,
          'message-sent',
          updatedMessage,
        );
      }

      return updatedMessage;
    } catch (error: any) {
      this.logger.error(`Failed to send media: ${error.message}`);
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async search(companyId: string, query: string, conversationId?: string) {
    const where: any = {
      companyId,
      content: { contains: query, mode: 'insensitive' },
    };
    if (conversationId) where.conversationId = conversationId;

    return this.prisma.message.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        conversation: {
          select: { id: true, customerName: true, customerPhone: true },
        },
        sentBy: { select: { id: true, name: true } },
      },
    });
  }

  async updateMessageStatus(
    whatsappMessageId: string,
    status: 'DELIVERED' | 'READ',
  ) {
    const message = await this.prisma.message.findUnique({
      where: { whatsappMessageId },
    });

    if (!message) return;

    const updateData: any = { status };
    if (status === 'DELIVERED') updateData.deliveredAt = new Date();
    if (status === 'READ') updateData.readAt = new Date();

    const updated = await this.prisma.message.update({
      where: { whatsappMessageId },
      data: updateData,
    });

    const gateway = this.getWebsocketGateway();
    if (gateway) {
      gateway.emitToConversation(
        message.conversationId,
        'message-status-updated',
        { messageId: message.id, status },
      );
    }

    return updated;
  }
}
