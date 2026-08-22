import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { AddMembersDto } from './dto/add-members.dto';

@UseGuards(JwtAuthGuard)
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly svc: CommunitiesService) {}

  @Post()
  create(@Body() dto: CreateCommunityDto, @Request() req: any) {
    return this.svc.create(req.user.id, dto);
  }

  @Get('mine')
  mine(@Request() req: any) {
    return this.svc.listMine(req.user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @Request() req: any) {
    return this.svc.get(id, req.user.id);
  }

  @Post(':id/members')
  addMembers(@Param('id') id: string, @Body() dto: AddMembersDto, @Request() req: any) {
    return this.svc.addMembers(id, req.user.id, dto.userIds);
  }
}
