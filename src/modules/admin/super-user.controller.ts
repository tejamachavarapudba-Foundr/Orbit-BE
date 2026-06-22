import { Controller, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { SuperUserService } from './super-user.service'; // 🟢 Updated Import
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperUserGuard } from '../../common/guards/super-user.guard';

@UseGuards(JwtAuthGuard, SuperUserGuard)
@Controller('super-user')
export class SuperUserController {
  constructor(private readonly svc: SuperUserService) {} // 🟢 Injected SuperUserService here

  @Post('admins')
  createAdmin(@Body() dto: { email: string; fullName: string; password?: string }) {
    return this.svc.createAdminAccount(dto);
  }

  @Patch('users/:id/role')
  changeRole(@Param('id') id: string, @Body() dto: { role: string }, @Req() req: any) {
    const superId = req.user.id;
    return this.svc.changeUserRole(id, dto.role, superId);
  }

  @Patch('users/:id/status')
  overrideUserStatus(@Param('id') id: string, @Body() dto: { isBanned: boolean }, @Req() req: any) {
    const superId = req.user.id;
    return this.svc.superUserToggleBan(id, dto.isBanned, superId);
  }

  @Delete('users/:id')
  hardDeleteUser(@Param('id') id: string, @Req() req: any) {
    const superId = req.user.id;
    return this.svc.superUserHardDelete(id, superId);
  }
}
