'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import apiClient from '@/lib/api-client';
import { useChatStore } from '@/stores/chatStore';

interface NewContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (conversation?: any) => void;
}

export function NewContactModal({ isOpen, onClose, onCreated }: NewContactModalProps) {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [initialMessage, setInitialMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const selectConversation = useChatStore((s) => s.selectConversation);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Formatar telefone ex: +55 (11) 99999-9999 ou numero limpo
        const phone = customerPhone.replace(/\D/g, '');
        if (phone.length < 10) {
            setError('Telefone invalido.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await apiClient.post('/conversations/contacts', {
                customerName: customerName.trim(),
                customerPhone: phone,
                initialMessage: initialMessage.trim() || undefined,
            });

            if (res.data && res.data.id) {
                selectConversation(res.data.id);
            }
            onCreated?.(res.data);
            setCustomerName('');
            setCustomerPhone('');
            setInitialMessage('');
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao criar contato.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Novo Contato</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="customerName">Nome do Contato</Label>
                        <Input
                            id="customerName"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Ex: João da Silva"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="customerPhone">Telefone (WhatsApp)</Label>
                        <Input
                            id="customerPhone"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Ex: 5511999999999"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="initialMessage">Mensagem Inicial (Opcional)</Label>
                        <Textarea
                            id="initialMessage"
                            value={initialMessage}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInitialMessage(e.target.value)}
                            placeholder="Digite uma mensagem para iniciar a conversa..."
                            rows={3}
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Iniciando...' : 'Iniciar Conversa'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
