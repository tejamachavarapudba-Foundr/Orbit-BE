import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async saveProgress(
    userId: string,
    dto: any,
  ) {
    return this.prisma.profile.update({
      where: {
        id: userId,
      },
      data: {
        role: dto.memberRole as any,
        onboardingGoals: dto.goals ?? [],
        onboardingStep: dto.step,
      },
    });
  }

  async completeOnboarding(
  userId: string,
  dto: any,
) {
  const quick = dto.quickProfile ?? {};

  const profile = await this.prisma.profile.update({
    where: {
      id: userId,
    },

    data: {
      fullName: quick.fullName ?? '',
      headline: quick.headline ?? '',
      location: quick.location ?? '',
      company: quick.company ?? '',
      website: quick.website ?? '',
      linkedinUrl: quick.linkedinUrl ?? '',

      role: dto.memberRole as any,

      onboardingGoals: dto.goals ?? [],
      onboardingCompleted: true,
      onboardingStep: 'completed',
      profileCompletion:
      dto.memberRole === "founder" ||
      dto.memberRole === "co_founder" ||
      dto.memberRole === "investor"
        ? 100
        : 90,
    },
  });

  if (dto.memberRole === 'founder') {
    await this.prisma.founderProfile.upsert({
      where: {
        profileId: userId,
      },

      update: {
        startupName:
          dto.quickProfile?.roleFields?.startupName ?? '',

        startupStage:
          dto.quickProfile?.roleFields?.startupStage ?? '',

        industry:
          dto.quickProfile?.roleFields?.industry ?? '',

        goals: dto.goals ?? [],
      },

      create: {
        profileId: userId,

        startupName:
          dto.quickProfile?.roleFields?.startupName ?? '',

        startupStage:
          dto.quickProfile?.roleFields?.startupStage ?? '',

        industry:
          dto.quickProfile?.roleFields?.industry ?? '',

        goals: dto.goals ?? [],
      },
    });
  }

  return profile;
}

  async getMatches(
    role: string,
    goals: string,
  ) {
    return {
      people: [],
      startups: [],
      role,
      goals,
    };
  }
}