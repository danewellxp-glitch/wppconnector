import { IsUUID } from 'class-validator';

export class AssignConversationDto {
  @IsUUID()
  userId: string;
}
