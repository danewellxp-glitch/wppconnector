'use client';

import { ContactsList } from '@/components/contacts/ContactsList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { CustomerInfo } from '@/components/chat/CustomerInfo';
import { useChatStore } from '@/stores/chatStore';

export default function ContactsPage() {
    const selectedId = useChatStore((s) => s.selectedConversationId);
    const conversations = useChatStore((s) => s.conversations);
    // Contacts page does not strictly use 'conversations' for the left list,
    // but selecting a chat sets 'selectedId' so the ChatWindow can show it.
    // We can find the active conversation locally or just fetch from API in CustomerInfo
    const conversation = conversations.find((c) => c.id === selectedId);

    return (
        <div className="flex h-full overflow-hidden">
            <ContactsList />
            <ChatWindow />
            {conversation && <CustomerInfo conversation={conversation} />}
        </div>
    );
}
