import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private svc: PostsService) {}

  @Get()
  list(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.list(userId);
  }

  @Get('saved')
  listSaved(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.listSaved(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post(':id/save')
  toggleSave(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.toggleSave(userId, id);
  }

  @Post(':id/report')
  reportPost(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.reportPost(userId, id, body?.reason ?? '');
  }

  @Post(':id/not-interested')
  markNotInterested(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.markNotInterested(userId, id);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor("files", 10, {
      storage: memoryStorage(),
      limits: {
      fileSize: 50 * 1024 * 1024,
    },
  }),
)
  async create(
    @UploadedFiles()
    files: Express.Multer.File[],

    @Body() body: any, @Req() req: any) {
    // req.user.sub or req.user.id depending on your JWT payload
    const userId = req.user.id || req.user.sub;
    const metadata = body.mediaMetadata
      ? Array.isArray(body.mediaMetadata)
        ? body.mediaMetadata.map((m) => JSON.parse(m))
        : [JSON.parse(body.mediaMetadata)]
      : [];

    return this.svc.create(
      userId,
      body,
      files,
      metadata,
    );
  };

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.svc.update(id, dto);
  }

   @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    // Extract the authenticated user's ID from the JWT payload
    const userId = req.user.id || req.user.sub;
    return this.svc.remove(id, userId); // 👈 Pass both IDs down
  }

}
