import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const TWILIO_VERIFY_BASE = 'https://verify.twilio.com/v2';

/** Talks to Twilio Verify's REST API directly (same no-SDK approach as
 * MailService uses for Resend) — no OTP codes, expiry, or attempt-limiting
 * are stored on our side; Twilio owns all of that. Auth uses an API Key
 * (SID + Secret) rather than the raw Account Auth Token, which is the
 * safer credential to hand a backend since it can be revoked independently
 * without invalidating the whole account. */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private get accountSid() {
    return process.env.TWILIO_ACCOUNT_SID ?? '';
  }

  private get apiKeySid() {
    return process.env.TWILIO_API_KEY_SID ?? '';
  }

  private get apiKeySecret() {
    return process.env.TWILIO_API_KEY_SECRET ?? '';
  }

  private get verifyServiceSid() {
    return process.env.TWILIO_VERIFY_SERVICE_SID ?? '';
  }

  get isConfigured() {
    return Boolean(this.accountSid && this.apiKeySid && this.apiKeySecret && this.verifyServiceSid);
  }

  private authHeader() {
    return 'Basic ' + Buffer.from(`${this.apiKeySid}:${this.apiKeySecret}`).toString('base64');
  }

  private assertConfigured() {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Phone verification is not set up yet — check back soon.');
    }
  }

  async sendOtp(phoneNumber: string) {
    this.assertConfigured();

    const res = await fetch(`${TWILIO_VERIFY_BASE}/Services/${this.verifyServiceSid}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phoneNumber, Channel: 'sms' }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Failed to send OTP to ${phoneNumber}: ${res.status} ${body}`);
      throw new ServiceUnavailableException("Couldn't send that code — check the number and try again.");
    }
  }

  /** Returns whether `code` was the valid, still-live code Twilio sent to
   * `phoneNumber`. A 404/400 from Twilio here means "no such pending
   * verification" (expired, already used, or never sent) — that's a normal
   * "not verified" outcome, not a server error. */
  async checkOtp(phoneNumber: string, code: string): Promise<boolean> {
    this.assertConfigured();

    const res = await fetch(`${TWILIO_VERIFY_BASE}/Services/${this.verifyServiceSid}/VerificationChecks`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phoneNumber, Code: code }),
    });

    if (!res.ok) return false;

    const data = (await res.json()) as { status?: string };
    return data.status === 'approved';
  }
}
