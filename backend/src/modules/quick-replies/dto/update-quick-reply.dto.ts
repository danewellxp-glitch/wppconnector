import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class UpdateQuickReplyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsString()
  shortcut?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
