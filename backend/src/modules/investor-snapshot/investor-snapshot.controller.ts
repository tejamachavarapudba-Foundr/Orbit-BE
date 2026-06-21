import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InvestorSnapshotService } from './investor-snapshot.service';

@UseGuards(JwtAuthGuard)
@Controller('investor-snapshot')
export class InvestorSnapshotController {
  constructor(
    private readonly svc: InvestorSnapshotService,
  ) {}

  // Route matches: GET /api/investor-snapshot/project/:projectId
  @Get('project/:projectId')
  getSnapshot(
    @Param('projectId') projectId: string,
  ) {
    return this.svc.getByProject(projectId);
  }

  // Route matches: POST /api/investor-snapshot/project/:projectId
  @Post('project/:projectId')
  createSnapshot(
    @Param('projectId') projectId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;

    return this.svc.create(
      projectId,
      userId,
      dto,
    );
  }

  // Route matches: PATCH /api/investor-snapshot/project/:projectId
  @Patch('project/:projectId')
  updateSnapshot(
    @Param('projectId') projectId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;

    return this.svc.update(
      projectId,
      userId,
      dto,
    );
  }
}
