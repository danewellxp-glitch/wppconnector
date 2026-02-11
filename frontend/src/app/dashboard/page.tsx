'use client';

import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { CustomerInfo } from '@/components/chat/CustomerInfo';
import { useChatStore } from '@/stores/chatStore';

export default function DashboardPage() {
  const selectedId = useChatStore((s) => s.selectedConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const conversation = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList />
      <ChatWindow />
      {conversation && <CustomerInfo conversation={conversation} />}
    </div>
  );
}
