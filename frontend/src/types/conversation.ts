import { Message } from './message';

export enum ConversationStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED',
}

export interface ConversationAssignment {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Conversation {
  id: string;
  companyId: string;
  customerPhone: string;
  customerName: string | null;
  status: ConversationStatus;
  lastMessageAt: string;
  unreadCount: number;
  metadata?: any;
  assignments?: ConversationAssignment[];
  messages?: Message[];
}
