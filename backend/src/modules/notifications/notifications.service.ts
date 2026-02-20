import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WebsocketGateway } from '../websocket/websocket.gateway';

export interface NewConversationPayload {
  conversationId: string;
  customerName: string;
  customerPhone: string;
  departmentId: string;
  departmentName: string;
  timestamp: Date;
}

export interface ConversationTransferredPayload {
  conversationId: string;
  customerName: string;
  customerPhone: string;
  transferredBy: string;
  fromDepartmentId: string;
  fromDepartmentName: string;
  toDepartmentId: string;
  toDepartmentName: string;
  timestamp: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private moduleRef: ModuleRef) {}

  private getWebsocketGateway(): WebsocketGateway | null {
    try {
      return this.moduleRef.get(WebsocketGateway, { strict: false });
    } catch (error) {
      return null;
    }
  }

  /**
   * Notifica o departamento sobre uma nova conversa atribuída
   */
  notifyNewConversation(payload: NewConversationPayload) {
    const gateway = this.getWebsocketGateway();
    if (!gateway) {
      this.logger.warn(
        'WebsocketGateway not available for new conversation notification',
      );
      return;
    }

    this.logger.log(
      `📢 Notificando departamento ${payload.departmentId} sobre nova conversa de ${payload.customerName}`,
    );

    gateway.emitToDepartment(payload.departmentId, 'new_conversation', {
      conversationId: payload.conversationId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      departmentName: payload.departmentName,
      timestamp: payload.timestamp,
    });
  }

  /**
   * Notifica o departamento de destino sobre uma transferência de conversa
   */
  notifyConversationTransferred(payload: ConversationTransferredPayload) {
    const gateway = this.getWebsocketGateway();
    if (!gateway) {
      this.logger.warn(
        'WebsocketGateway not available for conversation transferred notification',
      );
      return;
    }

    this.logger.log(
      `🔄 Notificando departamento ${payload.toDepartmentId} sobre transferência de conversa de ${payload.customerName} do departamento ${payload.fromDepartmentName}`,
    );

    gateway.emitToDepartment(
      payload.toDepartmentId,
      'conversation_transferred',
      {
        conversationId: payload.conversationId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        transferredBy: payload.transferredBy,
        fromDepartmentName: payload.fromDepartmentName,
        toDepartmentName: payload.toDepartmentName,
        timestamp: payload.timestamp,
      },
    );
  }

  /**
   * Emite um evento de auditoria para o enterprise
   */
  notifyAudit(companyId: string, message: string, metadata?: any) {
    const gateway = this.getWebsocketGateway();
    if (!gateway) {
      return;
    }

    this.logger.debug(`🔔 Auditoria: ${message}`);
    gateway.emitToCompany(companyId, 'audit_event', {
      message,
      metadata,
      timestamp: new Date(),
    });
  }
}
