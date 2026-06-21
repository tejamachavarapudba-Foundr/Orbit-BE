import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const validProfileRoles = new Set([
  'founder',
  'investor',
  'advisor',
  'professional',
  'service_provider',
  'co_founder',
  'software_engineer',
  'mentor',
  'policy_maker',
  'designer',
  'product_manager',
  'developer',
  'other',
]);

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.profile.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        founderProfile: true,
        investorProfile: true,
        advisorProfile: true,
        professionalProfile: true,
        serviceProviderProfile: true,
      },
    });
  }

  async get(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: {
        id,
      },
      include: {
        founderProfile: true,
        investorProfile: true,
        advisorProfile: true,
        professionalProfile: true,
        serviceProviderProfile: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async update(id: string, dto: UpdateProfileDto) {
    console.log('========================');
    console.log('PROFILE UPDATE DTO');
    console.log(JSON.stringify(dto, null, 2));
    console.log('========================');

    const role = validProfileRoles.has(dto.role ?? '')
      ? dto.role
      : undefined;

    const { roleProfile, ...profileData } = dto as any;

    try {
      await this.prisma.profile.update({
        where: {
          id,
        },
        data: {
          ...profileData,

          ...(role && {
            role: role as any,
          }),
        },
      });

      /*
       * Founder
       */
      if (roleProfile?.role === 'founder') {
        console.log('FOUNDER UPSERT START');
        console.log(JSON.stringify(roleProfile.data, null, 2));

        const founder = await this.prisma.founderProfile.upsert({
          where: {
            profileId: id,
          },

          update: {
            startupName: roleProfile.data?.startupName ?? '',
            startupStage: roleProfile.data?.startupStage ?? '',
            industry: roleProfile.data?.industry ?? '',
            pitch: roleProfile.data?.pitch ?? '',
            fundingNeeded: roleProfile.data?.fundingNeeded ?? '',
            teamSize: roleProfile.data?.teamSize ?? '',
            website: roleProfile.data?.website ?? '',
            goals: roleProfile.data?.goals ?? [],
          },

          create: {
            profileId: id,
            startupName: roleProfile.data?.startupName ?? '',
            startupStage: roleProfile.data?.startupStage ?? '',
            industry: roleProfile.data?.industry ?? '',
            pitch: roleProfile.data?.pitch ?? '',
            fundingNeeded: roleProfile.data?.fundingNeeded ?? '',
            teamSize: roleProfile.data?.teamSize ?? '',
            website: roleProfile.data?.website ?? '',
            goals: roleProfile.data?.goals ?? [],
          },
        });

        console.log('FOUNDER UPSERT RESULT');
        console.log(founder);
      }

      /*
       * Investor
       */
      if (roleProfile?.role === 'investor') {
        await this.prisma.investorProfile.upsert({
          where: {
            profileId: id,
          },

          update: {
            fundName: roleProfile.data?.fundName ?? '',
            investmentRange:
              roleProfile.data?.investmentRange ?? '',
            industries:
              roleProfile.data?.industries ?? [],
            geography:
              roleProfile.data?.geography ?? '',
            portfolio:
              roleProfile.data?.portfolio ?? '',
            goals:
              roleProfile.data?.goals ?? [],
          },

          create: {
            profileId: id,
            fundName: roleProfile.data?.fundName ?? '',
            investmentRange:
              roleProfile.data?.investmentRange ?? '',
            industries:
              roleProfile.data?.industries ?? [],
            geography:
              roleProfile.data?.geography ?? '',
            portfolio:
              roleProfile.data?.portfolio ?? '',
            goals:
              roleProfile.data?.goals ?? [],
          },
        });
      }

      /*
       * Return COMPLETE profile
       */
      return await this.prisma.profile.findUnique({
        where: {
          id,
        },

        include: {
          founderProfile: true,
          investorProfile: true,
          advisorProfile: true,
          professionalProfile: true,
          serviceProviderProfile: true,
        },
      });
    } catch (error) {
      console.error('PROFILE UPDATE ERROR');
      console.error(error);
      throw error;
    }
  }

  async updateAvatar(id: string, avatarUrl: string) {
    const profile = await this.prisma.profile.findUnique({
      where: {
        id,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.prisma.profile.update({
      where: {
        id,
      },
      data: {
        avatarUrl,
      },
    });

    return await this.prisma.profile.findUnique({
      where: {
        id,
      },

      include: {
        founderProfile: true,
        investorProfile: true,
        advisorProfile: true,
        professionalProfile: true,
        serviceProviderProfile: true,
      },
    });
  }
}