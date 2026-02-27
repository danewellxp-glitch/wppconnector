'use client';

import { ContactsTableView } from '@/components/contacts/ContactsTableView';

export default function ContactsPage() {
    return (
        <div className="flex h-full w-full overflow-hidden bg-white">
            <ContactsTableView />
        </div>
    );
}
