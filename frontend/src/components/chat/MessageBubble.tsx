'use client';

import { useState, useEffect } from 'react';
import { Message, Direction, MessageType, MessageStatus } from '@/types/message';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Mic,
  Video,
  Bot,
  Download,
  X,
  ZoomIn,
} from 'lucide-react';
import { CustomAudioPlayer } from './CustomAudioPlayer';

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case MessageStatus.PENDING:
      return <Clock className="h-3 w-3 text-gray-400" />;
    case MessageStatus.SENT:
      return <Check className="h-3 w-3 text-gray-400" />;
    case MessageStatus.DELIVERED:
      return <CheckCheck className="h-3 w-3 text-gray-400" />;
    case MessageStatus.READ:
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case MessageStatus.FAILED:
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [imgStyle, setImgStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const maxW = window.innerWidth * 0.92;
    const maxH = window.innerHeight * 0.92;
    const MAX_SCALE = 3;
    const scaleByWidth = maxW / img.naturalWidth;
    const scaleByHeight = maxH / img.naturalHeight;
    const scale = Math.min(scaleByWidth, scaleByHeight, MAX_SCALE);
    setImgStyle({
      width: img.naturalWidth * scale,
      height: img.naturalHeight * scale,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 text-white bg-white/10 hover:bg-white/25 rounded-full transition-colors"
        onClick={onClose}
        title="Fechar (Esc)"
      >
        <X className="h-6 w-6" />
      </button>

      <img
        src={src}
        alt={alt}
        style={imgStyle}
        className="rounded-lg shadow-2xl select-none object-contain"
        onClick={(e) => e.stopPropagation()}
        onLoad={handleLoad}
        draggable={false}
      />

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs select-none">
        Clique fora ou pressione Esc para fechar
      </p>
    </div>
  );
}

function MediaContent({ message }: { message: Message }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (message.mediaUrl) {
      window.open(message.mediaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const DownloadButton = () => message.mediaUrl ? (
    <button
      onClick={handleDownload}
      className="ml-2 p-1 rounded-full hover:bg-black/10 transition-colors"
      title="Baixar arquivo"
    >
      <Download className="h-4 w-4 opacity-70" />
    </button>
  ) : null;

  switch (message.type) {
    case MessageType.IMAGE:
      return message.mediaUrl ? (
        <>
          <div
            className="relative group block mb-1 cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={message.mediaUrl}
              alt={message.content || 'Imagem'}
              className="max-w-[260px] max-h-[260px] w-auto h-auto object-cover rounded-md"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-md transition-colors">
              <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
            <button
              onClick={handleDownload}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Baixar imagem"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>

          {lightboxOpen && (
            <ImageLightbox
              src={message.mediaUrl}
              alt={message.content || 'Imagem'}
              onClose={() => setLightboxOpen(false)}
            />
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>[Imagem]</span>
        </div>
      );

    case MessageType.DOCUMENT:
      return (
        <div className="w-full flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md mb-1 border cursor-pointer hover:bg-gray-100 transition-colors" onClick={handleDownload}>
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="h-5 w-5 text-blue-500 shrink-0" />
            <span className="text-sm truncate font-medium">
              {message.content || 'Documento'}
            </span>
          </div>
          <DownloadButton />
        </div>
      );

    case MessageType.AUDIO:
      return message.mediaUrl ? (
        <div className="flex items-center gap-2 mb-1 w-full">
          <CustomAudioPlayer src={message.mediaUrl} isOutbound={message.direction === Direction.OUTBOUND} />
          <DownloadButton />
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md mb-1 w-full">
          <Mic className="h-5 w-5 text-green-500 shrink-0" />
          <span className="text-sm">Audio</span>
        </div>
      );

    case MessageType.VIDEO:
      return (
        <div className="w-full flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md mb-1 border cursor-pointer hover:bg-gray-100 transition-colors" onClick={handleDownload}>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-500 shrink-0" />
            <span className="text-sm font-medium">
              {message.content || 'Video'}
            </span>
          </div>
          <DownloadButton />
        </div>
      );

    default:
      return null;
  }
}

function QuotedMessage({ quoted, isOutbound }: {
  quoted: { id?: string; body?: string; type?: string; fromMe?: boolean };
  isOutbound: boolean;
}) {
  if (!quoted.body) return null;

  const label = quoted.fromMe ? 'Você' : 'Contato';
  const borderColor = quoted.fromMe ? 'border-green-500' : 'border-gray-400';
  const bgColor = isOutbound ? 'bg-green-50' : 'bg-gray-50';

  return (
    <div className={`flex border-l-4 ${borderColor} ${bgColor} rounded-sm px-2 py-1 mb-2 max-w-full overflow-hidden`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 mb-0.5">{label}</p>
        <p className="text-xs text-gray-600 truncate max-w-[280px]">{quoted.body}</p>
      </div>
    </div>
  );
}

export function MessageBubble({ message, departmentName }: { message: Message; departmentName?: string }) {
  const isOutbound = message.direction === Direction.OUTBOUND;
  const isMediaMessage = message.type !== MessageType.TEXT;
  const isBot = message.isBot === true;

  return (
    <div
      className={cn(
        'flex mb-2',
        isOutbound ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2 shadow-sm',
          isBot
            ? 'bg-gray-100 text-gray-700 border border-gray-200 italic'
            : isOutbound
              ? 'bg-green-100 text-gray-900'
              : 'bg-white text-gray-900 border',
        )}
      >
        {message.metadata?.quotedMsg?.body && (
          <QuotedMessage quoted={message.metadata.quotedMsg} isOutbound={isOutbound} />
        )}
        {isBot && (
          <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
            <Bot className="h-3 w-3" /> Robô
          </p>
        )}
        {isOutbound && !isBot && message.sentBy && (
          <p className="text-xs font-medium text-green-700 mb-1">
            <span className="font-semibold">
              {message.sentBy.name}
              {departmentName && (
                <>
                  {' '}
                  <strong className="font-bold">{departmentName}</strong>
                </>
              )}
            </span>
          </p>
        )}

        {isMediaMessage && <MediaContent message={message} />}

        {(message.type === MessageType.TEXT || (isMediaMessage && message.content && message.content !== `[${message.type}]`)) && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.sentAt), 'HH:mm')}
          </span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
