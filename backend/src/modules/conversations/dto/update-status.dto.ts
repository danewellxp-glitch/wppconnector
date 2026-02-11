import { IsEnum } from 'class-validator';
import { ConversationStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(ConversationStatus)
  status: ConversationStatus;
}
