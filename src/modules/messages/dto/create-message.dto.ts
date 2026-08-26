import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateIf } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  // Empty content is fine for an attachment-only message — enforced instead
  // in the service, which rejects a message with neither content nor an
  // attachment at all.
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentKey?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;

  @IsOptional()
  @IsString()
  attachmentType?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  attachmentSize?: number;
}
