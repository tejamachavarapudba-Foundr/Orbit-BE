import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConnectionRequestsService } from './connection-requests.service';

@UseGuards(JwtAuthGuard)
@Controller('connections') 
export class ConnectionRequestsController {
  constructor(
    private readonly service: ConnectionRequestsService,
  ) {}

  @Post('requests')
  create(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      recipientId: string;
      note?: string;
    },
  ) {
    return this.service.createRequest(
      user.id,
      body.recipientId,
      body.note ?? '',
    );
  }

  @Get('requests/incoming')
  incoming(
    @CurrentUser() user: { id: string },
  ) {
    return this.service.getIncoming(user.id);
  }

  @Get('requests/outgoing')
  outgoing(
    @CurrentUser() user: { id: string },
  ) {
    return this.service.getOutgoing(user.id);
  }

  @Post('requests/:id/accept')
  accept(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.service.acceptRequest(
      id,
      user.id,
    );
  }

  @Post('requests/:id/decline')
  decline(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.service.declineRequest(
      id,
      user.id,
    );
  }

  @Delete('requests/:id')
  remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.service.deleteRequest(
      id,
      user.id,
    );
  }

  @Get('status/:userId')
  getStatus(
    @CurrentUser() user: { id: string },
    @Param('userId') targetUserId: string,
  ) {
    return this.service.getConnectionStatus(user.id, targetUserId);
  }

  // Batched status+count lookup for a list of user ids in one request —
  // used by list screens (Discover) instead of firing a separate
  // status + count request per visible card.
  @Post('bulk-info')
  getBulkInfo(
    @CurrentUser() user: { id: string },
    @Body() body: { userIds: string[] },
  ) {
    return this.service.getBulkConnectionInfo(user.id, body.userIds ?? []);
  }

  // URL: GET /api/connection/count/:userId
  @Get('count/:userId')
  getCount(
    @Param('userId') userId: string,
  ) {
    return this.service.getConnectionCount(userId);
  }

  // URL: GET /api/connection/:userId
  // Only the count is meant to be visible for other users (shown publicly
  // on Discover cards) — the actual list of who someone is connected to
  // is only ever fetched by the app for the logged-in user's own id, so
  // that's the only case this should allow.
  @Get(':userId')
  getConnected(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    if (userId !== user.id) {
      throw new ForbiddenException("You can only view your own connections list");
    }
    return this.service.getConnectedProfiles(userId);
  }

}