import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const InviteModeValues = ['startup', 'people'] as const;
const SchedulingModeValues = ['availability_pick', 'date_push'] as const;

export class ProposedSlotInput {
  @IsString()
  date: string; // "YYYY-MM-DD"

  @IsString()
  time: string; // "HH:mm"
}

export class CreateProposalDto {
  @IsIn(InviteModeValues)
  inviteMode: (typeof InviteModeValues)[number];

  @IsOptional()
  @IsString()
  targetStartupId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  inviteeUserIds?: string[];

  @IsString()
  purpose: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsIn(SchedulingModeValues)
  schedulingMode: (typeof SchedulingModeValues)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProposedSlotInput)
  selectedSlot?: ProposedSlotInput;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ProposedSlotInput)
  proposedSlots?: ProposedSlotInput[];

  @IsOptional()
  @IsString()
  timezone?: string;
}
