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
  switch (message.type) {
    case MessageType.IMAGE:
      return message.mediaUrl ? (
        <img
          src={message.mediaUrl}
          alt={message.content || 'Imagem'}
          className="max-w-full rounded-md mb-1"
          loading="lazy"
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>[Imagem]</span>
        </div>
      );

    case MessageType.DOCUMENT:
      return (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md mb-1">
          <FileText className="h-5 w-5 text-blue-500 shrink-0" />
          <span className="text-sm truncate">
            {message.content || 'Documento'}
          </span>
        </div>
      );

    case MessageType.AUDIO:
      return (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md mb-1">
          <Mic className="h-5 w-5 text-green-500 shrink-0" />
          <span className="text-sm">Audio</span>
        </div>
      );

    case MessageType.VIDEO:
      return (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md mb-1">
          <Video className="h-5 w-5 text-purple-500 shrink-0" />
          <span className="text-sm">
            {message.content || 'Video'}
          </span>
        </div>
      );

    default:
      return null;
  }
}

export function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === Direction.OUTBOUND;
  const isMediaMessage = message.type !== MessageType.TEXT;

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
          isOutbound
            ? 'bg-green-100 text-gray-900'
            : 'bg-white text-gray-900 border',
        )}
      >
        {isOutbound && message.sentBy && (
          <p className="text-xs font-medium text-green-700 mb-1">
            {message.sentBy.name}
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
