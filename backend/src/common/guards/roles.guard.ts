import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    
    // Normalize both strings to UPPERCASE to prevent 403 case mismatches
    if (!user || !user.role) {
      throw new ForbiddenException('User session role context is missing');
    }

    const userRoleUpper = user.role.toUpperCase();
    const hasRole = requiredRoles.some(role => role.toUpperCase() === userRoleUpper);

    if (!hasRole) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }
    return true;
  }
}
