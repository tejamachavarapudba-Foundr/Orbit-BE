import { Controller, ForbiddenException, Get, Post, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('follows')
export class FollowsController {
  constructor(private readonly svc: FollowsService) {}

  // 1. GET /follows/followers/:userId
  // Only the count is public (see getCounts below, shown on Discover cards
  // for anyone) — the full list is only ever fetched by the app for the
  // logged-in user's own id, so that's the only case allowed here.
  @Get('followers/:userId')
  getFollowers(@Req() req: any, @Param('userId') userId: string) {
    if (userId !== req.user.id) {
      throw new ForbiddenException("You can only view your own followers list");
    }
    return this.svc.getFollowers(userId);
  }

  // 2. GET /follows/following/:userId
  @Get('following/:userId')
  getFollowing(@Req() req: any, @Param('userId') userId: string) {
    if (userId !== req.user.id) {
      throw new ForbiddenException("You can only view your own following list");
    }
    return this.svc.getFollowing(userId);
  }

  // 2b. GET /follows/counts/:userId
  @Get('counts/:userId')
  getCounts(@Param('userId') userId: string) {
    return this.svc.getCounts(userId);
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
