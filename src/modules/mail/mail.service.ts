import { Injectable, Logger } from '@nestjs/common';

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private get apiKey() {
    return process.env.RESEND_API_KEY ?? '';
  }

  private get from() {
    return process.env.MAIL_FROM ?? 'Orbit <onboarding@resend.dev>';
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.apiKey) {
      this.logger.warn(`RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
      return;
    }

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Failed to send email to ${to}: ${res.status} ${body}`);
    }
  }

  async sendPasswordResetEmail(email: string, resetLink: string) {
    await this.send(
      email,
      'Reset your Orbit password',
      `<p>We received a request to reset your Orbit password.</p>
       <p><a href="${resetLink}">Tap here to choose a new password</a>. This link expires in 1 hour.</p>
       <p>If you didn't request this, you can safely ignore this email.</p>`,
    );
  }

  async sendVerificationEmail(email: string, verifyLink: string) {
    await this.send(
      email,
      'Confirm your Orbit email',
      `<p>Welcome to Orbit — confirm your email to finish setting up your account.</p>
       <p><a href="${verifyLink}">Tap here to confirm your email</a>. This link expires in 24 hours.</p>`,
    );
  }
}
