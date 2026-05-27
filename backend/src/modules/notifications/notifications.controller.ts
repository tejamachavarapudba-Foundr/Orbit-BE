import { Controller, Get, Patch, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  // GET /notifications
  @Get()
  list(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.list(userId);
  }

  // PATCH /notifications/read-all
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.readAll(userId);
  }

  // PATCH /notifications/:id/read
  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.markAsRead(id, userId);
  }
}
