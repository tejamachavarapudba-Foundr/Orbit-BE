import { Controller, Get, Param, Query, UseGuards, Post, Body, Req } from '@nestjs/common';
import { StartupsService } from './startups.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('startups')
export class StartupsController {
  constructor(private svc: StartupsService) {}

  // GET /startups?page=1&limit=20&stage=idea,mvp
  @Get()
  list(@Query() query: { page?: number; limit?: number; stage?: string | string[]; industry?: string }) {
    return this.svc.findAllStartups(query);
  }

  // GET /startups/trending?limit=10
  @Get('trending')
  getTrending(@Query('limit') limit?: string) {
    const numericLimit = limit ? parseInt(limit, 10) : 10;
    return this.svc.findTrending(numericLimit);
  }

  // GET /startups/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  // POST /startups/:id/reviews
  @Post(':id/reviews')
  async createReview(
    @Param('id') id: string,
    @Body() dto: { rating: number; comment?: string },
    @Req() req: any,
  ) {
    const reviewerId = req.user.id || req.user.sub;
    return await this.svc.addProjectReview(id, reviewerId, dto);
  }
}
