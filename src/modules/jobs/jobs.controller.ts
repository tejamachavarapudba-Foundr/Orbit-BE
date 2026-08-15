import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateJobDto } from "./dto/create-job.dto";
import { ApplyJobDto } from './dto/apply-job.dto';

@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  // GET /jobs
  @Get()
  list() {
    return this.svc.list();
  }

  // GET /jobs/mine/applications
  @Get('mine/applications')
  myApplications(@Req() req: any) {
    const applicantId = req.user.id || req.user.sub;
    return this.svc.myApplications(applicantId);
  }

  // GET /jobs/mine/posts
  @Get('mine/posts')
  myPosts(@Req() req: any) {
    const posterId = req.user.id || req.user.sub;
    return this.svc.myPosts(posterId);
  }

  // GET /jobs/mine/analytics
  @Get('mine/analytics')
  myAnalytics(@Req() req: any) {
    const posterId = req.user.id || req.user.sub;
    return this.svc.myAnalytics(posterId);
  }

  // GET /jobs/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  // POST /jobs
  @Post()
  createJob(
    @Body() dto: CreateJobDto,
    @Req() req: any,
  ) {
    const posterId = req.user.id || req.user.sub;
    return this.svc.createJob(posterId, dto);
  }

  // PATCH /jobs/:id
  @Patch(':id')
  updateJob(
    @Param('id') id: string,
    @Body() dto: CreateJobDto,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.svc.updateJob(id, userId, dto);
  }

  // DELETE /jobs/:id
  @Delete(':id')
  removeJob(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.removeJob(id, userId);
  }

  // POST /jobs/:id/apply
  @Post(':id/apply')
  applyToJob(
    @Param('id') id: string,
    @Body() dto: ApplyJobDto,
    @Req() req: any,
  ) {
    const applicantId = req.user.id || req.user.sub;
    return this.svc.applyToJob(id, applicantId, dto);
  }

  // PATCH /jobs/:id/applications/:appId
  @Patch(':id/applications/:appId')
  updateApplicationStatus(
    @Param('id') id: string,
    @Param('appId') appId: string,
    @Body() dto: { status: string }, // Expects: { "status": "accepted" | "rejected" }
  ) {
    return this.svc.processApplicationStatus(id, appId, dto.status);
  }
}
