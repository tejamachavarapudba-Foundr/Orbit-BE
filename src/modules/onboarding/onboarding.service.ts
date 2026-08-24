import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { calculateProfileCompletion } from '../profiles/profile-completion.util';

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
    const quick = dto.quickProfile ?? {};

    // Only write a quickProfile field when it actually has a value — the
    // "welcome" step sends an all-blank quickProfile (nothing has been typed
    // yet), and a blind `?? ''` here would erase whatever the profile
    // already had. Later steps (goals, quickProfile) then persist real
    // input as the user fills it in, instead of everything only landing at
    // the very end via completeOnboarding — until now saveProgress silently
    // dropped fullName/headline/location/company/website/linkedinUrl on
    // every intermediate call.
    const stringField = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value : undefined);

    return this.prisma.profile.update({
      where: {
        id: userId,
      },
      data: {
        role: dto.memberRole as any,
        onboardingGoals: dto.goals ?? [],
        lookingFor: dto.goals ?? [],
        onboardingStep: dto.step,
        ...(stringField(quick.fullName) !== undefined && { fullName: quick.fullName }),
        ...(stringField(quick.headline) !== undefined && { headline: quick.headline }),
        ...(stringField(quick.location) !== undefined && { location: quick.location }),
        ...(stringField(quick.company) !== undefined && { company: quick.company }),
        ...(stringField(quick.website) !== undefined && { website: quick.website }),
        ...(stringField(quick.linkedinUrl) !== undefined && { linkedinUrl: quick.linkedinUrl }),
      },
    });
  }

  async completeOnboarding(userId: string, dto: any) {
    const quick = dto.quickProfile ?? {};
    const roleData = dto.roleProfile?.data ?? {};
    const goals: string[] = dto.goals ?? [];

    await this.prisma.profile.update({
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
        lookingFor: goals,
        onboardingCompleted: true,
        onboardingStep: 'completed',
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

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: {
        founderProfile: true,
        investorProfile: true,
        advisorProfile: true,
        professionalProfile: true,
        serviceProviderProfile: true,
      },
    });

    const completion = calculateProfileCompletion(profile!);
    return this.prisma.profile.update({
      where: { id: userId },
      data: { profileCompletion: completion },
    });
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
        const overlapGoals = goals.length
          ? candidate.onboardingGoals.filter((goal) => goals.includes(goal))
          : [];
        return { candidate, overlap: overlapGoals.length, overlapGoals };
      })
      .sort((a, b) => b.overlap - a.overlap);

    for (const entry of scored) {
      const bucket = roleToBucket[entry.candidate.role as string];
      if (bucket) {
        roleCounts[bucket] += 1;
      }
    }

    const truncate = (value: string, max: number) =>
      value.length > max ? `${value.slice(0, max).trim()}…` : value;

    const people = scored.slice(0, 20).map((entry) => {
      const reasons: string[] = [];
      if (entry.overlapGoals.length) {
        const sharedGoals = entry.overlapGoals
          .slice(0, 2)
          .map((goal) => truncate(String(goal).trim(), 40));
        reasons.push(`Shared interests: ${sharedGoals.join(', ')}`);
      }
      if (entry.candidate.headline?.trim()) {
        reasons.push(truncate(entry.candidate.headline.trim(), 80));
      }

      return {
        id: entry.candidate.id,
        fullName: entry.candidate.fullName,
        headline: entry.candidate.headline,
        role: entry.candidate.role,
        avatarUrl: null,
        matchScore: Math.min(100, 40 + entry.overlap * 10),
        matchReasons: reasons,
      };
    });

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
