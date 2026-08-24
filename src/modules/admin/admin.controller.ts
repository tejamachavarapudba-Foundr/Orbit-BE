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

  // 2. GET /admin/users (Paginated, searchable user list)
  @Get('users')
  getUsers(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.svc.listUsers(parsedLimit, parsedPage, search);
  }

  // 3. PATCH /admin/users/:id/ban (Toggle ban/unban status)
  @Patch('users/:id/ban')
  toggleUserBan(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.id || req.user.sub; // Extracts the active admin ID
    return this.svc.toggleUserBan(id, adminId);  // Pass both arguments safely
  }

  // 4a. GET /admin/posts (Paginated, searchable post list — lets an admin
  // find a post's ID by author or content instead of needing it upfront)
  @Get('posts')
  getPosts(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.svc.listPosts(parsedLimit, parsedPage, search);
  }

  // 4b. DELETE /admin/posts/:id (Purge content violations)
  @Delete('posts/:id')
  deletePost(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.id || req.user.sub;
    return this.svc.removePost(id, adminId);
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
  getAuditLogs(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.svc.getSystemLogs(parsedLimit, parsedPage);
  }

  // 8. GET /admin/analytics (Growth, engagement, funnel and health metrics)
  @Get('analytics')
  getAnalytics() {
    return this.svc.getAnalytics();
  }

  // 9. Jobs moderation
  @Get('jobs')
  getJobs(@Query('limit') limit?: string, @Query('page') page?: string, @Query('search') search?: string) {
    return this.svc.listJobs(limit ? parseInt(limit, 10) : 20, page ? parseInt(page, 10) : 1, search);
  }

  @Delete('jobs/:id')
  deleteJob(@Param('id') id: string, @Req() req: any) {
    return this.svc.removeJob(id, req.user.id || req.user.sub);
  }

  // 10. Events moderation
  @Get('events')
  getEvents(@Query('limit') limit?: string, @Query('page') page?: string, @Query('search') search?: string) {
    return this.svc.listEvents(limit ? parseInt(limit, 10) : 20, page ? parseInt(page, 10) : 1, search);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string, @Req() req: any) {
    return this.svc.removeEvent(id, req.user.id || req.user.sub);
  }

  // 11. Communities moderation
  @Get('communities')
  getCommunities(@Query('limit') limit?: string, @Query('page') page?: string, @Query('search') search?: string) {
    return this.svc.listCommunities(limit ? parseInt(limit, 10) : 20, page ? parseInt(page, 10) : 1, search);
  }

  @Delete('communities/:id')
  deleteCommunity(@Param('id') id: string, @Req() req: any) {
    return this.svc.removeCommunity(id, req.user.id || req.user.sub);
  }
}
