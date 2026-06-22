import { Controller, Get, Patch, Delete, Param, UseGuards, Query, Req, Body } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard) // 🔒 Enforces both login session and Admin status globally across all routes
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  // 1. GET /admin/stats (Platform Health Metrics dashboard)
  @Get('stats')
  getStats() {
    return this.svc.getPlatformStats();
  }

  // 2. GET /admin/users (Paginated user list with sorting)
  @Get('users')
  getUsers(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.svc.listUsers(parsedLimit, parsedPage);
  }

  // 3. PATCH /admin/users/:id/ban (Toggle ban/unban status)
  @Patch('users/:id/ban')
  toggleUserBan(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.id || req.user.sub; // Extracts the active admin ID
    return this.svc.toggleUserBan(id, adminId);  // Pass both arguments safely
  }

  // 4. DELETE /admin/posts/:id (Purge content violations)
  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.svc.removePost(id);
  }

    // 5. GET /admin/projects (Monitor all listed projects/startups)
  @Get('projects')
  getProjects(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.svc.listProjects(parsedLimit, parsedPage);
  }

  // 6. PATCH /admin/projects/:id/verify (Manual Admin Verification Control)
  @Patch('projects/:id/verify')
  toggleProjectVerification(
    @Param('id') id: string,
    @Body() dto: { isVerified: boolean; verificationNotes?: string },
    @Req() req: any
  ) {
    const adminId = req.user.id || req.user.sub; // Extracts the active admin ID
    const verifyStatus = dto.isVerified === true;
    
    // Pass the parameters to match your updated service layer exactly
    return this.svc.verifyProject(id, verifyStatus, adminId);
  }


  // 7. GET /admin/audit-logs (Track system changes for platform security)
  @Get('audit-logs')
  getAuditLogs() {
    return this.svc.getSystemLogs();
  }
  
}
