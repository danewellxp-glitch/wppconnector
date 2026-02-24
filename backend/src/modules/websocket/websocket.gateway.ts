import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

function getCorsOrigins(): string | string[] {
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.10.156:3100';
  const origins = [frontendUrl];
  if (frontendUrl.includes('192.168.10.156')) {
    origins.push('http://localhost:3100', 'http://127.0.0.1:3100');
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  return origins;
}

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(
          `Conexão rejeitada - token não fornecido (${client.id})`,
        );
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.companyId = payload.companyId;
      client.data.departmentId = payload.departmentId ?? null;

      client.join(`company:${payload.companyId}`);
      if (payload.departmentId) {
        client.join(`department:${payload.departmentId}`);
      }
      client.join(`user:${payload.sub}`);

      this.logger.debug(`✓ Cliente conectado: ${payload.sub} (${client.id})`);
    } catch (error: any) {
      this.logger.error(`✗ Erro na conexão: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(
      `Cliente desconectado: ${client.data?.userId ?? 'unknown'} (${client.id})`,
    );
  }

  @SubscribeMessage('join-conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(`conversation:${conversationId}`);
    this.logger.debug(
      `User ${client.data.userId} joined conversation ${conversationId}`,
    );
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.leave(`conversation:${conversationId}`);
  }

  @SubscribeMessage('typing-start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.to(`conversation:${conversationId}`).emit('user-typing', {
      userId: client.data.userId,
      conversationId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing-stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.to(`conversation:${conversationId}`).emit('user-typing', {
      userId: client.data.userId,
      conversationId,
      isTyping: false,
    });
  }

  emitToConversation(conversationId: string, event: string, data: any) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  emitToCompany(companyId: string, event: string, data: any) {
    this.server.to(`company:${companyId}`).emit(event, data);
  }

  emitToDepartment(departmentId: string, event: string, data: any) {
    this.server.to(`department:${departmentId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
