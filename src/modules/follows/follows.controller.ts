import { Controller, Get, Post, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('follows')
export class FollowsController {
  constructor(private readonly svc: FollowsService) {}

  // 1. GET /follows/followers/:userId
  @Get('followers/:userId')
  getFollowers(@Param('userId') userId: string) {
    return this.svc.getFollowers(userId);
  }

  // 2. GET /follows/following/:userId
  @Get('following/:userId')
  getFollowing(@Param('userId') userId: string) {
    return this.svc.getFollowing(userId);
  }

  // 3. GET /follows/status/:userId
  @Get('status/:userId')
  getFollowStatus(@Req() req: any, @Param('userId') userId: string) {
    const currentUserId = req.user.id;
    return this.svc.getStatus(currentUserId, userId);
  }

  // 4. POST /follows/:userId (Follow a user)
  @Post(':userId')
  followUser(@Req() req: any, @Param('userId') userId: string) {
    const currentUserId = req.user.id;
    return this.svc.follow(currentUserId, userId);
  }

  // 5. DELETE /follows/:userId (Unfollow a user)
  @Delete(':userId')
  unfollowUser(@Req() req: any, @Param('userId') userId: string) {
    const currentUserId = req.user.id;
    return this.svc.unfollow(currentUserId, userId);
  }
}
