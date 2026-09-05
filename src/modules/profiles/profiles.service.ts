import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { StorageService } from '../storage/storage.service';
import { StorageType } from '../storage/enums/storage-type.enum';
import { calculateProfileCompletion } from './profile-completion.util';

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
      // Was returning every scalar column to any authenticated caller,
      // including other users' raw Firebase push tokens (fcmTokens) and
      // internal resume storage keys (resumeKey) — same leak fixed in
      // discover() above, fixed here too via omit rather than switching to
      // select, so the dozen+ existing callers (communities, events,
      // meetings, web's own pages, chat/follows lookups) keep getting the
      // exact same shape they already depend on, minus just these two.
      omit: {
        fcmTokens: true,
        resumeKey: true,
      },
      take: 200,
      relationLoadStrategy: 'join',
    });
  }

  // Real pagination + server-side search/role filtering for the Discover
  // screen, as a separate endpoint from list() above — list() is called
  // unpaginated from a dozen+ places (communities, events, meetings, the
  // web app's own pages) for a "most members" lookup set, so changing its
  // response shape would break all of those. This is Discover's own path:
  // it used to fetch list()'s capped 200 once and do search, role
  // filtering, and "load more" entirely client-side by slicing that array
  // — anyone past the 200th newest member was permanently invisible and
  // unsearchable, not just a perf issue.
  async discover(currentUserId: string, page: number, limit: number, query?: string, role?: string) {
    const searchTerm = query?.trim();

    const where: Prisma.ProfileWhereInput = {
      id: { not: currentUserId },
      ...(role && role !== 'all' ? { role: role as MemberRole } : {}),
      // fullName/headline/company/location cover the common searches —
      // skills/lookingFor are string arrays, and Postgres/Prisma can't do
      // substring matching inside array elements without raw SQL, so
      // exact-tag search on those (previously done client-side) isn't
      // included here.
      ...(searchTerm
        ? {
            OR: [
              { fullName: { contains: searchTerm, mode: 'insensitive' } },
              { headline: { contains: searchTerm, mode: 'insensitive' } },
              { company: { contains: searchTerm, mode: 'insensitive' } },
              { location: { contains: searchTerm, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [profiles, totalCount] = await this.prisma.$transaction([
      this.prisma.profile.findMany({
        where,
        // Explicit select, not a bare findMany — list() above (and this
        // endpoint, before this fix) returns every scalar column including
        // fcmTokens (other users' raw Firebase push tokens) and resumeKey
        // (an internal storage key) to any authenticated caller. Browse
        // cards don't need either, so they're left out entirely here
        // rather than fetched and then stripped.
        select: {
          id: true,
          fullName: true,
          headline: true,
          bio: true,
          role: true,
          location: true,
          language: true,
          company: true,
          website: true,
          linkedinUrl: true,
          skills: true,
          lookingFor: true,
          openToConnect: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          onboardingCompleted: true,
          onboardingGoals: true,
          profileCompletion: true,
          identityVerified: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.profile.count({ where }),
    ]);

    return { profiles, totalCount, hasMore: page * limit < totalCount };
  }

  async get(id: string) {
    // Only ever used to view someone else's public profile (getUserById on
    // the frontend) — the signed-in owner's own resumeKey flows through
    // /auth/me instead, so omitting it here doesn't affect that.
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
      omit: {
        fcmTokens: true,
        resumeKey: true,
      },
      relationLoadStrategy: 'join',
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
            industry: roleProfile.data?.industry ?? [],
            pitch: roleProfile.data?.pitch ?? '',
            fundingNeeded: roleProfile.data?.fundingNeeded ?? '',
            teamSize: roleProfile.data?.teamSize ?? '',
            website: roleProfile.data?.website ?? '',
            founderStatus: roleProfile.data?.founderStatus ?? '',
            currentRole: roleProfile.data?.currentRole ?? '',
            currentRoleOther: roleProfile.data?.currentRoleOther ?? '',
            portfolio: roleProfile.data?.portfolio ?? [],
            goals: roleProfile.data?.goals ?? [],
          },

          create: {
            profileId: id,
            startupName: roleProfile.data?.startupName ?? '',
            startupStage: roleProfile.data?.startupStage ?? '',
            industry: roleProfile.data?.industry ?? [],
            pitch: roleProfile.data?.pitch ?? '',
            fundingNeeded: roleProfile.data?.fundingNeeded ?? '',
            teamSize: roleProfile.data?.teamSize ?? '',
            website: roleProfile.data?.website ?? '',
            founderStatus: roleProfile.data?.founderStatus ?? '',
            currentRole: roleProfile.data?.currentRole ?? '',
            currentRoleOther: roleProfile.data?.currentRoleOther ?? '',
            portfolio: roleProfile.data?.portfolio ?? [],
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
              roleProfile.data?.portfolio ?? [],
            investorType:
              roleProfile.data?.investorType ?? '',
            investorTypeOther:
              roleProfile.data?.investorTypeOther ?? '',
            investingAs:
              roleProfile.data?.investingAs ?? '',
            investmentStage:
              roleProfile.data?.investmentStage ?? [],
            yearsInvestingExperience:
              roleProfile.data?.yearsInvestingExperience ?? '',
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
              roleProfile.data?.portfolio ?? [],
            investorType:
              roleProfile.data?.investorType ?? '',
            investorTypeOther:
              roleProfile.data?.investorTypeOther ?? '',
            investingAs:
              roleProfile.data?.investingAs ?? '',
            investmentStage:
              roleProfile.data?.investmentStage ?? [],
            yearsInvestingExperience:
              roleProfile.data?.yearsInvestingExperience ?? '',
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
            expertiseOther: roleProfile.data?.expertiseOther ?? '',
            yearsExperience: roleProfile.data?.yearsExperience ?? '',
            industries: roleProfile.data?.industries ?? [],
            mentorshipAreas: roleProfile.data?.mentorshipAreas ?? [],
            mentorshipExperience: roleProfile.data?.mentorshipExperience ?? '',
            certifications: roleProfile.data?.certifications ?? [],
            experiences: roleProfile.data?.experiences ?? [],
            goals: roleProfile.data?.goals ?? [],
          },
          create: {
            profileId: id,
            expertise: roleProfile.data?.expertise ?? [],
            expertiseOther: roleProfile.data?.expertiseOther ?? '',
            yearsExperience: roleProfile.data?.yearsExperience ?? '',
            industries: roleProfile.data?.industries ?? [],
            mentorshipAreas: roleProfile.data?.mentorshipAreas ?? [],
            mentorshipExperience: roleProfile.data?.mentorshipExperience ?? '',
            certifications: roleProfile.data?.certifications ?? [],
            experiences: roleProfile.data?.experiences ?? [],
            goals: roleProfile.data?.goals ?? [],
          },
        });
      }

      /*
       * Professional
       */
      if (roleProfile?.role === 'professional') {
        const existingProfessional = await this.prisma.professionalProfile.findUnique({
          where: { profileId: id },
          select: { certifications: true, verificationStatus: true },
        });

        const newCertifications = roleProfile.data?.certifications ?? [];
        const certsChanged =
          JSON.stringify(existingProfessional?.certifications ?? []) !== JSON.stringify(newCertifications);

        // No certifications submitted: nothing to review, so status is null
        // (not "pending"). Certifications changed while non-empty: always
        // moves to pending, whether that's a first submission, a
        // resubmission after rejection, or new content added after an
        // earlier approval — re-review is required either way. Unchanged
        // certifications leave the existing status untouched.
        const verificationStatus: 'pending' | null | undefined =
          newCertifications.length === 0 ? null : certsChanged ? 'pending' : undefined;
        const clearsReview = verificationStatus !== undefined;

        await this.prisma.professionalProfile.upsert({
          where: { profileId: id },
          update: {
            skills: roleProfile.data?.skills ?? [],
            experienceLevel: roleProfile.data?.experienceLevel ?? '',
            experiencePeriods: roleProfile.data?.experiencePeriods ?? [],
            portfolio: roleProfile.data?.portfolio ?? '',
            resume: roleProfile.data?.resume ?? '',
            specialization: roleProfile.data?.specialization ?? '',
            specializationOther: roleProfile.data?.specializationOther ?? '',
            certifications: newCertifications,
            experiences: roleProfile.data?.experiences ?? [],
            goals: roleProfile.data?.goals ?? [],
            ...(verificationStatus !== undefined && { verificationStatus }),
            ...(clearsReview && { reviewedBy: null, reviewNotes: null, reviewedAt: null }),
          },
          create: {
            profileId: id,
            skills: roleProfile.data?.skills ?? [],
            experienceLevel: roleProfile.data?.experienceLevel ?? '',
            experiencePeriods: roleProfile.data?.experiencePeriods ?? [],
            portfolio: roleProfile.data?.portfolio ?? '',
            resume: roleProfile.data?.resume ?? '',
            specialization: roleProfile.data?.specialization ?? '',
            specializationOther: roleProfile.data?.specializationOther ?? '',
            certifications: newCertifications,
            experiences: roleProfile.data?.experiences ?? [],
            goals: roleProfile.data?.goals ?? [],
            verificationStatus: newCertifications.length === 0 ? null : 'pending',
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
            servicesOther: roleProfile.data?.servicesOther ?? '',
            website: roleProfile.data?.website ?? '',
            companyLinkedinUrl: roleProfile.data?.companyLinkedinUrl ?? '',
            clientIndustries: roleProfile.data?.clientIndustries ?? [],
            goals: roleProfile.data?.goals ?? [],
          },
          create: {
            profileId: id,
            company: roleProfile.data?.company ?? '',
            services: roleProfile.data?.services ?? [],
            servicesOther: roleProfile.data?.servicesOther ?? '',
            website: roleProfile.data?.website ?? '',
            companyLinkedinUrl: roleProfile.data?.companyLinkedinUrl ?? '',
            clientIndustries: roleProfile.data?.clientIndustries ?? [],
            goals: roleProfile.data?.goals ?? [],
          },
        });
      }

      /*
       * Return COMPLETE profile
       */
      return await this.recomputeCompletion(id);
    } catch (error) {
      console.error('PROFILE UPDATE ERROR');
      console.error(error);
      throw error;
    }
  }

  /**
   * Recomputes profileCompletion from the profile's actual current fields
   * (not a role-based flat constant) and persists it if it changed.
   */
  private async recomputeCompletion(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      include: {
        founderProfile: true,
        investorProfile: true,
        advisorProfile: true,
        professionalProfile: true,
        serviceProviderProfile: true,
      },
      relationLoadStrategy: 'join',
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const completion = calculateProfileCompletion(profile);
    if (completion === profile.profileCompletion) {
      return profile;
    }

    return this.prisma.profile.update({
      where: { id },
      data: { profileCompletion: completion },
      include: {
        founderProfile: true,
        investorProfile: true,
        advisorProfile: true,
        professionalProfile: true,
        serviceProviderProfile: true,
      },
      relationLoadStrategy: 'join',
    });
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
  return this.recomputeCompletion(profile.id);
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

    return this.recomputeCompletion(profile.id);
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
      relationLoadStrategy: 'join',
    });
  }
}