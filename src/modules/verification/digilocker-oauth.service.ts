import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

// DigiLocker Partner API (meripehchaan.gov.in) — standard OAuth2 authorization-code flow.
// Once a Partner API application is approved at api.digitallocker.gov.in, the issued
// client_id/client_secret/redirect_uri go into the env vars below and this starts working
// with no code changes. The exact profile-pull path (DIGILOCKER_PROFILE_URL) should be
// confirmed against the Partner API docs for the approved API tier before going live —
// it defaults to the documented "eaadhaar"/basic profile endpoint.
const DEFAULT_AUTH_URL = 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize';
const DEFAULT_TOKEN_URL = 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/token';
const DEFAULT_PROFILE_URL = 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/user';

type DigilockerTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type DigilockerProfile = {
  name?: string;
  dob?: string;
  gender?: string;
  eaadhaar?: string;
};

@Injectable()
export class DigilockerOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private get clientId() {
    return process.env.DIGILOCKER_CLIENT_ID ?? '';
  }

  private get clientSecret() {
    return process.env.DIGILOCKER_CLIENT_SECRET ?? '';
  }

  private get redirectUri() {
    return process.env.DIGILOCKER_REDIRECT_URI ?? '';
  }

  get isConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildAuthUrl(userId: string) {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Identity verification via DigiLocker is not configured yet — check back soon.',
      );
    }

    const state = this.jwt.sign({ sub: userId });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });
    const authUrl = process.env.DIGILOCKER_AUTH_URL || DEFAULT_AUTH_URL;
    return `${authUrl}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    let userId: string;
    try {
      const payload = this.jwt.verify<{ sub: string }>(state);
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired verification session');
    }

    const tokenUrl = process.env.DIGILOCKER_TOKEN_URL || DEFAULT_TOKEN_URL;
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      throw new BadRequestException('DigiLocker rejected the authorization code');
    }

    const tokens = (await tokenRes.json()) as DigilockerTokenResponse;
    const profile = await this.fetchProfile(tokens.access_token);

    // We only need proof that a real, government-verified identity completed the
    // handshake — the verified name is kept for admin cross-checks (e.g. against a
    // founder's registration certificate); no Aadhaar number or eKYC XML is stored.
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        identityVerified: true,
        identityVerifiedAt: new Date(),
        fullName: profile.name || undefined,
      },
    });

    return userId;
  }

  private async fetchProfile(accessToken: string): Promise<DigilockerProfile> {
    const profileUrl = process.env.DIGILOCKER_PROFILE_URL || DEFAULT_PROFILE_URL;
    const res = await fetch(profileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    return (await res.json()) as DigilockerProfile;
  }
}
