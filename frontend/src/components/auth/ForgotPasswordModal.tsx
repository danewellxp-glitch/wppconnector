import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import apiClient from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');
        if (!email || !reason) return;

        setIsLoading(true);
        try {
            await apiClient.post('/auth/forgot-password', { email, reason });
            setSuccessMessage('Solicitação enviada. Um administrador revisará seu pedido de redefinição de senha em breve.');
            setEmail('');
            setReason('');

            // Fecha o modal após 3 segundos no caso de sucesso
            setTimeout(() => {
                setSuccessMessage('');
                onClose();
            }, 3000);

        } catch (error) {
            setErrorMessage('Ocorreu um problema ao enviar a solicitação. Tente novamente mais tarde.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Problemas com o acesso?</DialogTitle>
                    <DialogDescription>
                        Como não utilizamos e-mail externo, sua solicitação será enviada internamente para um administrador do sistema aprovar e redefinir sua senha.
                    </DialogDescription>
                </DialogHeader>

                {successMessage && (
                    <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-200">
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                        {errorMessage}
                    </div>
                )}

                {!successMessage && (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail de Acesso</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu.email@empresa.com.br"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reason">Motivo</Label>
                            <Input
                                id="reason"
                                placeholder="Ex: Esqueci minha senha desde o último acesso"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading || !email || !reason}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Solicitar Redefinição
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
