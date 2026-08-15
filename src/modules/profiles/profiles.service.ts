import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { StorageService } from '../storage/storage.service';
import { StorageType } from '../storage/enums/storage-type.enum';

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
  constructor(private readonly  prisma: PrismaService,
    private readonly storageService: StorageService,  
  ) {}

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
        await this.prisma.founderProfile.upsert({
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
       * Advisor
       */
      if (roleProfile?.role === 'advisor') {
        await this.prisma.advisorProfile.upsert({
          where: { profileId: id },
          update: {
            expertise: roleProfile.data?.expertise ?? [],
            yearsExperience: roleProfile.data?.yearsExperience ?? '',
            industries: roleProfile.data?.industries ?? [],
            mentorshipAreas: roleProfile.data?.mentorshipAreas ?? [],
            goals: roleProfile.data?.goals ?? [],
          },
          create: {
            profileId: id,
            expertise: roleProfile.data?.expertise ?? [],
            yearsExperience: roleProfile.data?.yearsExperience ?? '',
            industries: roleProfile.data?.industries ?? [],
            mentorshipAreas: roleProfile.data?.mentorshipAreas ?? [],
            goals: roleProfile.data?.goals ?? [],
          },
        });
      }

      /*
       * Professional
       */
      if (roleProfile?.role === 'professional') {
        await this.prisma.professionalProfile.upsert({
          where: { profileId: id },
          update: {
            skills: roleProfile.data?.skills ?? [],
            experienceLevel: roleProfile.data?.experienceLevel ?? '',
            portfolio: roleProfile.data?.portfolio ?? '',
            resume: roleProfile.data?.resume ?? '',
            specialization: roleProfile.data?.specialization ?? '',
            specializationOther: roleProfile.data?.specializationOther ?? '',
            goals: roleProfile.data?.goals ?? [],
          },
          create: {
            profileId: id,
            skills: roleProfile.data?.skills ?? [],
            experienceLevel: roleProfile.data?.experienceLevel ?? '',
            portfolio: roleProfile.data?.portfolio ?? '',
            resume: roleProfile.data?.resume ?? '',
            specialization: roleProfile.data?.specialization ?? '',
            specializationOther: roleProfile.data?.specializationOther ?? '',
            goals: roleProfile.data?.goals ?? [],
          },
        });
      }

      /*
       * Service provider
       */
      if (roleProfile?.role === 'service_provider') {
        await this.prisma.serviceProviderProfile.upsert({
          where: { profileId: id },
          update: {
            company: roleProfile.data?.company ?? '',
            services: roleProfile.data?.services ?? [],
            website: roleProfile.data?.website ?? '',
            clientIndustries: roleProfile.data?.clientIndustries ?? [],
            goals: roleProfile.data?.goals ?? [],
          },
          create: {
            profileId: id,
            company: roleProfile.data?.company ?? '',
            services: roleProfile.data?.services ?? [],
            website: roleProfile.data?.website ?? '',
            clientIndustries: roleProfile.data?.clientIndustries ?? [],
            goals: roleProfile.data?.goals ?? [],
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

  async updateAvatar(
  userId: string,
  file: Express.Multer.File,
) {
  const profile = await this.prisma.profile.findUnique({
    where: {
      id: userId,
    },
  });

  if (!profile) {
    throw new NotFoundException(
      'Profile not found',
    );
  }

  // Upload new avatar
  const upload = await this.storageService.upload(
    file,
    StorageType.AVATAR,
    profile.id,
  );

  // Delete previous avatar (if exists)
  if (profile.avatarUrl) {
    try {
      const oldPath =
        this.storageService.extractPathFromUrl(
          profile.avatarUrl,
        );

      if (oldPath) {
        await this.storageService.delete(
          StorageType.AVATAR,
          oldPath,
        );
      }
    } catch (error) {
      // Do not fail avatar update if old file deletion fails
      console.warn(
        'Failed to delete previous avatar',
        error,
      );
    }
  }

  // Save new URL
  await this.prisma.profile.update({
    where: {
      id: profile.id,
    },
    data: {
      avatarUrl: upload.url,
    },
  });

  // Return updated profile
  return this.prisma.profile.findUnique({
    where: {
      id: profile.id,
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

    async updateResume(
    userId: string,
    file: Express.Multer.File,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: {
        id: userId,
      },
    });

    if (!profile) {
      throw new NotFoundException(
        "Profile not found",
      );
    }

    // Upload new resume
    const upload = await this.storageService.upload(
      file,
      StorageType.RESUME,
      profile.id,
    );

    // Delete previous resume
    if (profile.resumeKey) {
      try {
        await this.storageService.delete(
          StorageType.RESUME,
          profile.resumeKey,
        );
      } catch (error) {
        console.warn(
          "Failed to delete previous resume",
          error,
        );
      }
    }

    // Save metadata
    await this.prisma.profile.update({
      where: {
        id: profile.id,
      },
      data: {
        resumeKey: upload.path,
        resumeFileName: upload.originalFileName,
        resumeFileSize: upload.size,
        resumeUpdatedAt: new Date(),
      },
    });

    return this.prisma.profile.findUnique({
      where: {
        id: profile.id,
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

    async deleteResume(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: {
        id: userId,
      },
    });

    if (!profile) {
      throw new NotFoundException("Profile not found");
    }

    // Delete file from Supabase
    if (profile.resumeKey) {
      try {
        await this.storageService.delete(
          StorageType.RESUME,
          profile.resumeKey,
        );
      } catch (error) {
        console.warn(
          "Failed to delete resume from storage",
          error,
        );
      }
    }

    // Remove metadata from database
    await this.prisma.profile.update({
      where: {
        id: userId,
      },
      data: {
        resumeKey: null,
        resumeFileName: null,
        resumeFileSize: null,
        resumeUpdatedAt: null,
      },
    });

    return this.prisma.profile.findUnique({
      where: {
        id: userId,
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