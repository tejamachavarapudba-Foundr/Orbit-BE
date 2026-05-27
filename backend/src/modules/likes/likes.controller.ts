import { Controller, Get, Post, Delete, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('likes')
export class LikesController {
  constructor(private readonly svc: LikesService) {}

  // GET /api/likes?postId=UUID
  @Get()
  async list(@Query('postId') postId: string) {
    return await this.svc.list(postId);
  }

  // POST /api/likes/:postId (This is now your automatic safe toggle endpoint)
  @Post(':postId')
  async like(@Param('postId') postId: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return await this.svc.like(userId, postId);
  }

  // DELETE /api/likes/:postId (Optional fallback endpoint for absolute removal)
  @Delete(':postId')
  async unlike(@Param('postId') postId: string, @Req() req: any) {
    // 1. Get the current user's role from the JWT payload
    const userRole = req.user.role; 

    // 2. Security Guard: If they are NOT an admin, block them from using DELETE
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only administrators can forcefully delete likes.');
    }

    // 3. Admin verified, execute the deletion
    const userId = req.user.id || req.user.sub;
    return await this.svc.unlike(userId, postId);
  }
}
