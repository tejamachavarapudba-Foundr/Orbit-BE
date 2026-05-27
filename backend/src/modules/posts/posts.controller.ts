import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';

@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private svc: PostsService) {}

  @Get()
  list() { return this.svc.list(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  async create(@Body() dto: CreatePostDto, @Req() req: any) {
    // req.user.sub or req.user.id depending on your JWT payload
    const userId = req.user.id || req.user.sub;
    return this.svc.create(userId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }

   @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    // Extract the authenticated user's ID from the JWT payload
    const userId = req.user.id || req.user.sub;
    return this.svc.remove(id, userId); // 👈 Pass both IDs down
  }

}
