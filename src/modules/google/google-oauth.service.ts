import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptToken, decryptToken } from '../../common/utils/crypto.util';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events email';

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private get clientId() {
    return process.env.GOOGLE_CLIENT_ID ?? '';
  }

  private get clientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET ?? '';
  }

  private get redirectUri() {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '';
  }

  buildAuthUrl(userId: string, platform: 'web' | 'mobile' = 'mobile') {
    const state = this.jwt.sign({ sub: userId, platform });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPE,
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /** Recovers which platform initiated the OAuth flow from the (possibly
   * unverifiable, e.g. expired) state token, so the callback can redirect
   * to the right place even when handleCallback itself is about to fail. */
  decodePlatform(state: string): 'web' | 'mobile' {
    try {
      const payload = this.jwt.decode<{ platform?: 'web' | 'mobile' }>(state);
      return payload?.platform === 'web' ? 'web' : 'mobile';
    } catch {
      return 'mobile';
    }
  }

  async handleCallback(code: string, state: string) {
    let userId: string;
    try {
      const payload = this.jwt.verify<{ sub: string }>(state);
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new BadRequestException('Google rejected the authorization code');
    }

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokens.refresh_token) {
      // Google only returns a refresh token on first consent (prompt=consent forces
      // this), but guard anyway rather than silently storing an account we can't refresh.
      throw new BadRequestException('Google did not return a refresh token — reconnect and approve access again');
    }

    const email = await this.fetchGoogleEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.prisma.connectedGoogleAccount.upsert({
      where: { userId },
      create: {
        userId,
        googleEmail: email,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
      },
      update: {
        googleEmail: email,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        revokedAt: null,
      },
    });

    return userId;
  }

  private async fetchGoogleEmail(accessToken: string) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { email?: string };
    return data.email ?? '';
  }

  async getStatus(userId: string) {
    const account = await this.prisma.connectedGoogleAccount.findUnique({ where: { userId } });
    if (!account || account.revokedAt) {
      return { connected: false as const };
    }
    return { connected: true as const, email: account.googleEmail };
  }

  async disconnect(userId: string) {
    await this.prisma.connectedGoogleAccount.update({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  /** Returns a valid, decrypted access token for this user, refreshing it first if expired. */
  async getValidAccessToken(userId: string): Promise<string> {
    const account = await this.prisma.connectedGoogleAccount.findUnique({ where: { userId } });
    if (!account || account.revokedAt) {
      throw new BadRequestException('Connect Google Meet before creating a meeting');
    }

    if (account.tokenExpiresAt.getTime() > Date.now() + 60_000) {
      return decryptToken(account.accessTokenEnc);
    }

    const refreshToken = decryptToken(account.refreshTokenEnc);
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      await this.prisma.connectedGoogleAccount.update({
        where: { userId },
        data: { revokedAt: new Date() },
      });
      throw new BadRequestException('Google access was revoked — reconnect Google Meet');
    }

    const refreshed = (await res.json()) as GoogleTokenResponse;
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    await this.prisma.connectedGoogleAccount.update({
      where: { userId },
      data: {
        accessTokenEnc: encryptToken(refreshed.access_token),
        tokenExpiresAt: expiresAt,
      },
    });

    return refreshed.access_token;
  }
}
