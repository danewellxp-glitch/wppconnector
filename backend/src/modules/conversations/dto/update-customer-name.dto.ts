import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateCustomerNameDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string | null;
}
