import { Body, Controller, Delete, Get, Patch, Param, Post, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushService } from '../push/push.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly push: PushService,
  ) {}

  // POST /notifications/device-token
  @Post('device-token')
  @HttpCode(HttpStatus.OK)
  registerDeviceToken(@Body('token') token: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.push.registerToken(userId, token);
  }

  // DELETE /notifications/device-token
  @Delete('device-token')
  @HttpCode(HttpStatus.OK)
  unregisterDeviceToken(@Body('token') token: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.push.unregisterToken(userId, token);
  }

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
