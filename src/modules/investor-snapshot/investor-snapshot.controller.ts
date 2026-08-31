import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InvestorSnapshotService } from './investor-snapshot.service';
import { PdfExtractionService } from './pdf-extraction.service';

@UseGuards(JwtAuthGuard)
@Controller('investor-snapshot')
export class InvestorSnapshotController {
  constructor(
    private readonly svc: InvestorSnapshotService,
    private readonly extractionSvc: PdfExtractionService,
  ) {}

  // Route matches: GET /api/investor-snapshot/project/:projectId
  @Get('project/:projectId')
  getSnapshot(@Param('projectId') projectId: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.svc.getByProject(projectId, userId);
  }

  // Route matches: POST /api/investor-snapshot/project/:projectId
  @Post('project/:projectId')
  createSnapshot(
    @Param('projectId') projectId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    
    return this.svc.create(projectId, userId, dto);
  }

  // Route matches: PATCH /api/investor-snapshot/project/:projectId
  @Patch('project/:projectId')
  updateSnapshot(
    @Param('projectId') projectId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;

    return this.svc.update(projectId, userId, dto);
  }

  // Route matches: POST /api/investor-snapshot/project/:projectId/extract-pdf
  // Reads a founder's pitch deck and returns a best-effort draft of Investor
  // Snapshot fields for the frontend to pre-fill — never writes to the DB.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post('project/:projectId/extract-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  extractFromPdf(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.extractionSvc.extractFromPdf(projectId, userId, file);
  }
}
