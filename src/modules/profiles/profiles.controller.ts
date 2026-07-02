import { Body, Controller, Get, Post, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private svc: ProfilesService) {}

  @Patch('me/avatar')
  @UseInterceptors(
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  }),
)
updateAvatar(
  @CurrentUser() user: { id: string },
  @UploadedFile() file: Express.Multer.File,
) {
  return this.svc.updateAvatar(
    user.id,
    file,
  );
}

  @Get() list() { return this.svc.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Patch('me') update(@CurrentUser() u: { id: string }, @Body() dto: UpdateProfileDto) {
    return this.svc.update(u.id, dto);
  }
}
