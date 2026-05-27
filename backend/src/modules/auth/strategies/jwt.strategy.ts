import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    // Return BOTH id, sub, and role to preserve backwards compatibility across your entire app
    return { 
      id: payload.sub, 
      sub: payload.sub, 
      email: payload.email,
      role: payload.role // 🟢 Extracted token role attached onto req.user object securely
    };
  }
}
