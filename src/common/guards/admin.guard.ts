import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access Denied: User profile data could not be validated');
    }

    // 2. Safe extraction of the role property
    const userRole = user.role || user.UserRole;

    if (!userRole || typeof userRole !== 'string') {
      throw new ForbiddenException('Access Denied: Verification role properties are missing');
    }

    // 3. Case-insensitive check — SUPER_USER is a strict superset of ADMIN
    // (can also create admins, change roles, hard-delete accounts via
    // SuperUserGuard-protected routes), so it must pass this gate too.
    const role = userRole.toUpperCase();
    if (role !== 'ADMIN' && role !== 'SUPER_USER') {
      throw new ForbiddenException('Access Denied: Administrative privileges required');
    }

    return true;
  }
}
