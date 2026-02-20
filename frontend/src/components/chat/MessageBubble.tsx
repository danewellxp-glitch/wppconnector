'use client';

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
} from 'lucide-react';

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

function MediaContent({ message }: { message: Message }) {
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
        <div className="relative group inline-block max-w-full mb-1">
          <img
            src={message.mediaUrl}
            alt={message.content || 'Imagem'}
            className="rounded-md"
            loading="lazy"
          />
          <button
            onClick={handleDownload}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Baixar imagem"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>[Imagem]</span>
        </div>
      );

    case MessageType.DOCUMENT:
      return (
        <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md mb-1 border cursor-pointer hover:bg-gray-100 transition-colors" onClick={handleDownload}>
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
        <div className="flex items-center gap-2 mb-1">
          <audio controls src={message.mediaUrl} className="max-w-[200px] h-10" />
          <DownloadButton />
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md mb-1">
          <Mic className="h-5 w-5 text-green-500 shrink-0" />
          <span className="text-sm">Audio</span>
        </div>
      );

    case MessageType.VIDEO:
      return (
        <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md mb-1 border cursor-pointer hover:bg-gray-100 transition-colors" onClick={handleDownload}>
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
