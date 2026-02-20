'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, X, FileText, Image, Mic } from 'lucide-react';
import { useSendMessage, useSendMedia } from '@/hooks/useMessages';
import { useSocket } from '@/hooks/useSocket';
import { QuickRepliesPanel } from './QuickRepliesPanel';
import { toast } from 'sonner';

interface MessageInputProps {
  conversationId: string;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function MessageInput({ conversationId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessage();
  const sendMedia = useSendMedia();
  const { emitTypingStart, emitTypingStop } = useSocket();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPending = sendMessage.isPending || sendMedia.isPending;

  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId]);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo nao permitido. Use formatos de imagem, áudio, PDF, Office ou Texto.');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Limite: 10 MB.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isPending) return;

    if (selectedFile) {
      sendMedia.mutate(
        { conversationId, file: selectedFile, caption: content.trim() || undefined },
        {
          onSuccess: () => { clearFile(); setContent(''); },
          onError: () => { toast.error('Erro ao enviar arquivo'); clearFile(); },
        },
      );
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) return;

    setContent('');
    emitTypingStop(conversationId);
    sendMessage.mutate({ conversationId, content: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    emitTypingStart(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTypingStop(conversationId), 2000);
  };

  const handleQuickReply = (replyContent: string) => {
    setContent(replyContent);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [content]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error('Tipo nao permitido. Use formatos de imagem, áudio, PDF, Office ou Texto.');
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error('Arquivo muito grande. Limite: 10 MB.');
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    }
  };

  return (
    <div
      className={`border-t bg-white relative ${isDragging ? 'bg-green-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-green-100/90 border-2 border-dashed border-green-500 rounded-t-lg backdrop-blur-sm">
          <p className="text-green-800 font-semibold text-lg flex items-center gap-2">
            <Paperclip className="h-6 w-6" /> Solte o arquivo aqui para enviar
          </p>
        </div>
      )}
      {/* File preview bar */}
      {selectedFile && (
        <div className="flex items-center gap-3 px-4 py-2 bg-green-50 border-b">
          {filePreview ? (
            <img src={filePreview} alt="preview" className="h-10 w-10 object-cover rounded" />
          ) : (
            <FileText className="h-8 w-8 text-green-700 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-green-800 truncate">{selectedFile.name}</p>
            <p className="text-xs text-green-600">{(selectedFile.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="p-1 rounded-full hover:bg-green-200 transition-colors"
            title="Remover arquivo"
          >
            <X className="h-4 w-4 text-green-800" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-4">
        {/* Quick Replies Panel */}
        <QuickRepliesPanel onSelect={handleQuickReply} />

        {/* File picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.mp3,.ogg,.wav,.webm"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
          title="Anexar arquivo"
        >
          {selectedFile?.type.startsWith('image/') ? (
            <Image className="h-4 w-4 text-green-600" />
          ) : selectedFile?.type.startsWith('audio/') ? (
            <Mic className="h-4 w-4 text-green-600" />
          ) : (
            <Paperclip className="h-4 w-4 text-gray-500" />
          )}
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? 'Adicionar legenda (opcional)...' : 'Digite uma mensagem...'}
          className="flex-1 resize-none rounded-lg border bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700"
          disabled={(!content.trim() && !selectedFile) || isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
