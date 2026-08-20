import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ProposedSlotInput } from './create-proposal.dto';

const ActionValues = ['accept', 'reject'] as const;

export class RespondProposalDto {
  @IsIn(ActionValues)
  action: (typeof ActionValues)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProposedSlotInput)
  selectedSlot?: ProposedSlotInput;

  @IsOptional()
  @IsString()
  replyMessage?: string;
}
