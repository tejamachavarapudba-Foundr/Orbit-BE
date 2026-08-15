import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

const VALID_MEMBER_ROLES = [
  'founder',
  'investor',
  'advisor',
  'professional',
  'service_provider',
];

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async saveProgress(userId: string, dto: any) {
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

  async completeOnboarding(userId: string, dto: any) {
    const quick = dto.quickProfile ?? {};
    const roleData = dto.roleProfile?.data ?? {};
    const goals: string[] = dto.goals ?? [];

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

        onboardingGoals: goals,
        onboardingCompleted: true,
        onboardingStep: 'completed',
        profileCompletion:
          dto.memberRole === 'founder' ||
          dto.memberRole === 'co_founder' ||
          dto.memberRole === 'investor'
            ? 100
            : 90,
      },
    });

    switch (dto.memberRole) {
      case 'founder': {
        const data = {
          startupName: roleData.startupName ?? '',
          startupStage: roleData.startupStage ?? '',
          industry: roleData.industry ?? '',
          goals,
        };
        await this.prisma.founderProfile.upsert({
          where: { profileId: userId },
          update: data,
          create: { profileId: userId, ...data },
        });
        break;
      }
      case 'investor': {
        const data = {
          fundName: roleData.fundName ?? '',
          investmentRange: roleData.investmentRange ?? '',
          industries: roleData.industries ?? [],
          geography: roleData.geography ?? '',
          portfolio: roleData.portfolio ?? '',
          goals,
        };
        await this.prisma.investorProfile.upsert({
          where: { profileId: userId },
          update: data,
          create: { profileId: userId, ...data },
        });
        break;
      }
      case 'advisor': {
        const data = {
          expertise: roleData.expertise ?? [],
          yearsExperience: roleData.yearsExperience ?? '',
          industries: roleData.industries ?? [],
          mentorshipAreas: roleData.mentorshipAreas ?? [],
          goals,
        };
        await this.prisma.advisorProfile.upsert({
          where: { profileId: userId },
          update: data,
          create: { profileId: userId, ...data },
        });
        break;
      }
      case 'professional': {
        const data = {
          skills: roleData.skills ?? [],
          experienceLevel: roleData.experienceLevel ?? '',
          portfolio: roleData.portfolio ?? '',
          resume: roleData.resume ?? '',
          specialization: roleData.specialization ?? '',
          specializationOther: roleData.specializationOther ?? '',
          goals,
        };
        await this.prisma.professionalProfile.upsert({
          where: { profileId: userId },
          update: data,
          create: { profileId: userId, ...data },
        });
        break;
      }
      case 'service_provider': {
        const data = {
          company: roleData.company ?? '',
          services: roleData.services ?? [],
          website: roleData.website ?? '',
          clientIndustries: roleData.clientIndustries ?? [],
          goals,
        };
        await this.prisma.serviceProviderProfile.upsert({
          where: { profileId: userId },
          update: data,
          create: { profileId: userId, ...data },
        });
        break;
      }
      default:
        break;
    }

    return profile;
  }

  async getMatches(role: string, goalsParam: string) {
    const goals = (goalsParam ?? '')
      .split(',')
      .map((goal) => goal.trim())
      .filter(Boolean);

    const roleCounts: Record<string, number> = {
      investors: 0,
      founders: 0,
      advisors: 0,
      professionals: 0,
      serviceProviders: 0,
    };

    const roleToBucket: Record<string, keyof typeof roleCounts> = {
      investor: 'investors',
      founder: 'founders',
      co_founder: 'founders',
      advisor: 'advisors',
      professional: 'professionals',
      service_provider: 'serviceProviders',
    };

    const candidates = await this.prisma.profile.findMany({
      where: {
        onboardingCompleted: true,
        role: role && VALID_MEMBER_ROLES.includes(role) ? { not: role as any } : undefined,
      },
      select: {
        id: true,
        fullName: true,
        headline: true,
        role: true,
        onboardingGoals: true,
      },
      take: 100,
    });

    const scored = candidates
      .map((candidate) => {
        const overlap = goals.length
          ? candidate.onboardingGoals.filter((goal) => goals.includes(goal)).length
          : 0;
        return { candidate, overlap };
      })
      .filter((entry) => goals.length === 0 || entry.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap);

    for (const entry of scored) {
      const bucket = roleToBucket[entry.candidate.role as string];
      if (bucket) {
        roleCounts[bucket] += 1;
      }
    }

    const people = scored.slice(0, 20).map((entry) => ({
      id: entry.candidate.id,
      fullName: entry.candidate.fullName,
      headline: entry.candidate.headline,
      role: entry.candidate.role,
    }));

    return {
      people,
      startups: [],
      role,
      goals: goalsParam,
      total: scored.length,
      breakdown: roleCounts,
    };
  }
}
