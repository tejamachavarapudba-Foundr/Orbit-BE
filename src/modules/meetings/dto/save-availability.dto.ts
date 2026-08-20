import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class AvailabilitySlotInput {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime must be HH:mm' })
  startTime: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime must be HH:mm' })
  endTime: string;
}

export class SaveAvailabilityDto {
  @IsString()
  timezone: string;

  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotInput)
  slots: AvailabilitySlotInput[];
}
