import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { SaveOnboardingDto } from './dto/save-onboarding.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
  ) {}

  @Patch('profiles/me/onboarding')
  saveProgress(
    @Req() req,
    @Body() dto: SaveOnboardingDto,
  ) {
    return this.onboardingService.saveProgress(
      req.user.id,
      dto,
    );
  }

  @Post('profiles/me/onboarding/complete')
  completeOnboarding(
    @Req() req,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.onboardingService.completeOnboarding(
      req.user.id,
      dto,
    );
  }

  @Get('recommendations/matches')
  getMatches(
    @Query('role') role: string,
    @Query('goals') goals: string,
  ) {
    return this.onboardingService.getMatches(
      role,
      goals,
    );
  }
}