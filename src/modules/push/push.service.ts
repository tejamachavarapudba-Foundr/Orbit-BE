import { Injectable, Logger } from '@nestjs/common';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private app: App | null = null;

  constructor(private readonly prisma: PrismaService) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Railway env vars can't hold literal newlines, so the private key is
    // stored with escaped \n sequences and unescaped here.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase Admin credentials not configured — push notifications are disabled.');
      return;
    }

    this.app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  async registerToken(profileId: string, token: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) return;

    if (profile.fcmTokens.includes(token)) return;

    await this.prisma.profile.update({
      where: { id: profileId },
      data: { fcmTokens: { push: token } },
    });
  }

  async unregisterToken(profileId: string, token: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) return;

    await this.prisma.profile.update({
      where: { id: profileId },
      data: { fcmTokens: profile.fcmTokens.filter((t) => t !== token) },
    });
  }

  async sendToProfile(profileId: string, title: string, body: string) {
    if (!this.app) return;

    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.fcmTokens.length === 0) return;

    try {
      const response = await getMessaging(this.app).sendEachForMulticast({
        tokens: profile.fcmTokens,
        notification: { title, body },
      });

      const invalidTokens = response.responses
        .map((result, index) => ({ result, token: profile.fcmTokens[index] }))
        .filter(
          ({ result }) =>
            !result.success &&
            (result.error?.code === 'messaging/registration-token-not-registered' ||
              result.error?.code === 'messaging/invalid-registration-token'),
        )
        .map(({ token }) => token);

      if (invalidTokens.length > 0) {
        await this.prisma.profile.update({
          where: { id: profileId },
          data: { fcmTokens: profile.fcmTokens.filter((t) => !invalidTokens.includes(t)) },
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to send push notification to profile ${profileId}`, error as Error);
    }
  }
}
