import { Body, Controller, Get, Post, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private svc: ProfilesService) {}

  @Post('me/avatar') // 👈 Place this ABOVE any @Get(':id') or @Patch(':id')
  async uploadAvatar(@Req() req: any, @Body('avatarUrl') avatarUrl: string) {
    // Assuming your JwtAuthGuard attaches the profile or user ID to req.user
    const profileId = req.user.profileId || req.user.id; 
    return this.svc.updateAvatar(profileId, avatarUrl);
  }

  @Get() list() { return this.svc.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Patch('me') update(@CurrentUser() u: { id: string }, @Body() dto: UpdateProfileDto) {
    return this.svc.update(u.id, dto);
  }
}
