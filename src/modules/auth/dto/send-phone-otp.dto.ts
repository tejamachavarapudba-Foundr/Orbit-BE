import { IsPhoneNumber } from 'class-validator';

export class SendPhoneOtpDto {
  // Requires E.164 format (e.g. +919876543210) — the client is responsible
  // for combining country code + local number before sending this.
  @IsPhoneNumber()
  phoneNumber: string;
}
