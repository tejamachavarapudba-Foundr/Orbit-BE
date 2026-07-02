import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  // GET /search?search=ai&type=projects&role=Founder&stage=Idea&category=SaaS
  @Get()
  async list( @Req() req: any,
    @Query('search') search?: string,
    @Query('type') type: string = 'all',
    @Query('role') role?: string,
    @Query('stage') stage?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    
    // Aligns perfectly with the flat parameters expected by your search.service.ts
    return this.svc.list(
      req.user.id,
      search?.trim() || '',
      type,
      role,
      parsedLimit,
      stage,
      category,
    );
  }
}
