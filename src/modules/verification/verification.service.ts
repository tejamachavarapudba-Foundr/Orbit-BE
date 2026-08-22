import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitFounderVerificationDto } from './dto/submit-founder-verification.dto';
import { ReviewFounderVerificationDto } from './dto/review-founder-verification.dto';

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(profileId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        founderVerification: true,
        investorProfile: true,
        advisorProfile: true,
        professionalProfile: true,
        serviceProviderProfile: true,
      },
    });

    if (!profile) throw new NotFoundException('Profile not found');

    return {
      identityVerified: profile.identityVerified,
      identityVerifiedAt: profile.identityVerifiedAt,
      founder: profile.founderVerification
        ? {
            status: profile.founderVerification.status,
            reviewNotes: profile.founderVerification.reviewNotes,
            certificateName: profile.founderVerification.certificateName,
            cinNumber: profile.founderVerification.cinNumber,
            documentUrl: profile.founderVerification.documentUrl,
            submittedAt: profile.founderVerification.createdAt,
          }
        : null,
      // Investor/professional/advisor/service-provider have no proof of authenticity to
      // check — "verified" here just means the relevant self-declared fields are filled in.
      investorVerified: Boolean(profile.company.trim() && profile.website.trim()),
      professionalVerified: Boolean(
        profile.professionalProfile?.experienceLevel?.trim() ||
          (Array.isArray(profile.professionalProfile?.experiences) && profile.professionalProfile.experiences.length > 0),
      ),
      advisorVerified: Boolean(
        profile.advisorProfile?.yearsExperience?.trim() ||
          (Array.isArray(profile.advisorProfile?.experiences) && profile.advisorProfile.experiences.length > 0),
      ),
      serviceProviderVerified: Boolean(
        profile.serviceProviderProfile?.company?.trim() &&
          profile.serviceProviderProfile?.website?.trim() &&
          profile.serviceProviderProfile?.companyLinkedinUrl?.trim(),
      ),
    };
  }

  async submitFounderVerification(profileId: string, dto: SubmitFounderVerificationDto) {
    return this.prisma.founderVerification.upsert({
      where: { profileId },
      update: {
        documentUrl: dto.documentUrl,
        documentKey: dto.documentKey,
        certificateName: dto.certificateName,
        cinNumber: dto.cinNumber ?? '',
        status: 'pending',
        reviewedBy: null,
        reviewNotes: null,
        reviewedAt: null,
      },
      create: {
        profileId,
        documentUrl: dto.documentUrl,
        documentKey: dto.documentKey,
        certificateName: dto.certificateName,
        cinNumber: dto.cinNumber ?? '',
      },
    });
  }

  async listPendingFounderVerifications() {
    return this.prisma.founderVerification.findMany({
      where: { status: 'pending' },
      include: {
        profile: { select: { id: true, fullName: true, avatarUrl: true, headline: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewFounderVerification(profileId: string, adminId: string, dto: ReviewFounderVerificationDto) {
    const existing = await this.prisma.founderVerification.findUnique({ where: { profileId } });
    if (!existing) throw new NotFoundException('No founder verification submission found for this profile');

    const updated = await this.prisma.founderVerification.update({
      where: { profileId },
      data: {
        status: dto.status,
        reviewedBy: adminId,
        reviewNotes: dto.reviewNotes ?? '',
        reviewedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'FOUNDER_VERIFICATION_REVIEWED',
        details: `Founder verification for profile ${profileId} set to ${dto.status}`,
        targetId: profileId,
      },
    });

    return updated;
  }
}
