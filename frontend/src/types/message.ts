export enum Direction {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export interface Message {
  id: string;
  conversationId: string;
  whatsappMessageId?: string;
  direction: Direction;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  status: MessageStatus;
  isBot?: boolean;
  sentById?: string;
  sentBy?: {
    id: string;
    name: string;
  };
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  metadata?: {
    quotedMsg?: {
      id?: string;
      body?: string;
      type?: string;
      fromMe?: boolean;
    };
    [key: string]: unknown;
  };
}
