'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';

export function UnreadTitleManager() {
    const conversations = useChatStore((s) => s.conversations);

    useEffect(() => {
        const totalUnread = conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);

        if (totalUnread > 0) {
            document.title = `(${totalUnread}) Veloce`;
        } else {
            document.title = 'Veloce';
        }
    }, [conversations]);

    return null;
}
