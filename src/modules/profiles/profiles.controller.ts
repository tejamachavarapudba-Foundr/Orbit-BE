import { Body, Controller, Get, Post, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private svc: ProfilesService) {}

  @Patch('me/avatar')
  updateAvatar(
  @CurrentUser() user: { id: string },
  @Body() dto: UpdateAvatarDto,
) {
  return this.svc.updateAvatar(
    user.id,
    dto.avatarUrl,
  );
}

  @Get() list() { return this.svc.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Patch('me') update(@CurrentUser() u: { id: string }, @Body() dto: UpdateProfileDto) {
    return this.svc.update(u.id, dto);
  }
}
