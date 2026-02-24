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

export interface Department {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  customerPhone: string;
  customerName: string | null;
  status: ConversationStatus;
  lastMessageAt: string;
  unreadCount: number;
  departmentId?: string | null;
  department?: Department | null;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string; email?: string } | null;
  flowState?: string;
  metadata?: Record<string, unknown>;
  assignments?: ConversationAssignment[];
  messages?: Message[];
}
