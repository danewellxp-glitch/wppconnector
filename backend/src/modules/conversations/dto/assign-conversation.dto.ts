import { IsString, IsNotEmpty } from 'class-validator';

export class AssignConversationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
