import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MemberRole } from '@prisma/client';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UpdateProjectDto } from './dto/update-project.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.id);
  }

  // GET /projects/reels?cursor=&limit= — must stay above @Get(':id') or "reels"
  // would be swallowed as an :id value.
  @Get('reels')
  listReels(@Req() req: any, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const userId = req.user.id || req.user.sub;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 10, 30) : 10;
    return this.svc.listReels(userId, cursor, parsedLimit);
  }

  // Same reasoning — must stay above @Get(':id').
  @Get('browse')
  browse(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('query') query?: string,
    @Query('stage') stage?: string,
    @Query('projectType') projectType?: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.svc.browse(userId, pageNum, limitNum, query, stage, projectType);
  }

  @Post()
  create(@Body() dto: any, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.create(userId, dto);
  }

  @Patch(':id/logo')
  @UseInterceptors(
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  }),
  )
  updateLogo(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
  @Req() req: any,
  ) {
  const userId =
    req.user.id || req.user.sub;

  return this.svc.updateLogo(
    id,
    userId,
    file,
  );
  }

  @Patch(':id/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  updateCover(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.svc.updateCover(id, userId, file);
  }

  @Patch(':id/pitch-video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  updatePitchVideo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.svc.updatePitchVideo(id, userId, file);
  }

    @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Req() req: any) {
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
  async getApplications(@Param('id') id: string, @Query('role') role: MemberRole | undefined, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return await this.svc.getApplicationsByRole(id, userId, role);
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

  @Post(":id/like")
  toggleLike(@Param("id") id: string, @Req() req: any) {
    return this.svc.toggleLike(req.user.id, id);
  }

  @Post(":id/view")
  markViewed(@Param("id") id: string, @Req() req: any) {
    return this.svc.markViewed(req.user.id, id);
  }

}
