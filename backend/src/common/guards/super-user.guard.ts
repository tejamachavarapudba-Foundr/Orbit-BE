import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 🔴 SECURITY GATE: Deny access if the actor is not explicitly a SUPER_USER
    if (!user || user.role !== 'SUPER_USER') {
      throw new ForbiddenException('Access Denied: Super User privileges required');
    }

    return true;
  }
}
