import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MemberRole } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

  @Get() 
  list() { 
    return this.svc.list(); 
  }

  @Post()
  create(@Body() dto: any, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.create(userId, dto);
  }

    @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.update(id, userId, dto); // Passed userId as the second argument
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.remove(id, userId); // Passed userId as the second argument
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

    // GET /projects/:id/members
  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    return await this.svc.getProjectMembers(id);
  }


  // POST /projects/:id/jobs (Post a new job vacancy)
  @Post(':id/jobs')
  async createJob(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    const posterId = req.user.id || req.user.sub;
    return await this.svc.createJob(id, posterId, dto);
  }

  // POST /projects/:id/applications (Apply to project / job)
  @Post(':id/applications')
  async createApplication(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    await this.svc.addApplication(id, userId, dto); 
    return `Application created for project ${id}`;
  }

  // GET /projects/:id/applications (View all incoming applications)
  @Get(':id/applications')
  async getApplications(@Param('id') id: string, @Query('role') role?: MemberRole) {
    return await this.svc.getApplicationsByRole(id, role);
  }

    // PATCH /projects/:id/applications/:appId (Approve or Reject an applicant)
  @Patch(':id/applications/:appId')
  async updateApplication(
    @Param('id') id: string, 
    @Param('appId') appId: string,
    @Body() dto: any,
    @Req() req: any
  ) {
    const userId = req.user.id || req.user.sub;
    return await this.svc.processApplicationStatus(id, userId, appId, dto);
  }

  @Post(":id/save")
  saveStartup(
    @Param("id") id: string,
    @Req() req: any,
  ) {
    return this.svc.saveStartup(
      req.user.id,
     id,
    );
  }

  @Delete(":id/save")
  unsaveStartup(
    @Param("id") id: string,
    @Req() req: any,
  ) {
    return this.svc.unsaveStartup(
      req.user.id,
      id,
    );
  }

  @Get("saved/list")
  getSavedStartups(
    @Req() req: any,
  ) {
    return this.svc.getSavedStartups(
      req.user.id,
    );
  }

}
