// src/modules/events/dto/create-event.dto.ts
import { IsArray, IsBoolean, IsString, IsNotEmpty, IsOptional, IsISO8601, IsNumber } from 'class-validator';

export class CreateEventDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsNotEmpty() location: string;
  @IsISO8601() @IsNotEmpty() startsAt: string;
  @IsISO8601() @IsOptional() endsAt?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;

  @IsBoolean() @IsOptional() isPrivate?: boolean;
  @IsString() @IsOptional() communityId?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() inviteeIds?: string[];
}

export class CancelEventDto {
  @IsString() 
  @IsNotEmpty() 
  Reason: string;
}
