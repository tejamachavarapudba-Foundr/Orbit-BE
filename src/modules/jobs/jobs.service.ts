import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobApplicationStatus } from '@prisma/client';
import { CreateJobDto } from "./dto/create-job.dto";
import { ApplyJobDto } from "./dto/apply-job.dto";

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. GET ALL VACANCIES
  async list() {
    return this.prisma.job.findMany({
      include: {
        poster: true,
        applications: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 2. GET SINGLE JOB DETAILS
  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        poster: true,
        applications: {
          include: { applicant: true },
        },
      },
    });
    if (!job) throw new NotFoundException(`Job listing with ID ${id} not found`);
    return job;
  }

  // 3. POST A NEW VACANCY
  async createJob(posterId: string, dto: CreateJobDto) {
    const profile = await this.prisma.profile.findUnique({
        where: {
            id: posterId,
        },
    });

if (!profile) {
    throw new NotFoundException(
        "Profile not found.",
    );
}

const allowedRoles = [
  "founder",
  "co_founder",
  "investor",
  "hr",
];

if (!allowedRoles.includes(profile.role)) {
  throw new ForbiddenException(
    "Only founders, co-founders, investors and HR can post jobs.",
  );
}

    return this.prisma.job.create({
      data: {
        startupName: dto.startupName,
        heading: dto.heading,
        role: dto.role || "other",
        experience: dto.experience || "Not specified",
        skills: dto.skills || [],
        description: dto.description || "",
        poster: { connect: { id: posterId } },
      },
    });
  }

  // 4. PATCH AN EXISTED JOB
  async updateJob(id: string, userId: string, dto: any) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job listing not found');

    if (job.posterId !== userId) {
      throw new ForbiddenException('You do not have permission to edit this job post.');
    }

    return this.prisma.job.update({
      where: { id },
      data: {
        heading: dto.heading,
        role: dto.role,
        experience: dto.experience,
        skills: dto.skills,
        description: dto.description,
      },
    });
  }

  // 5. DELETE A VACANCY
  async removeJob(id: string, userId: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job listing not found');

    if (job.posterId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this job post.');
    }

    await this.prisma.job.delete({ where: { id } });
    return { success: true, message: 'Job listing deleted successfully' };
  }

  // 6. POST /jobs/:id/apply (SUBMIT APPLICATION)
  async applyToJob(jobId: string, applicantId: string, dto: ApplyJobDto) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job listing not found');

    if (job.posterId === applicantId) {
      throw new BadRequestException('You cannot apply to a job vacancy that you posted.');
    }

    const applicant =
      await this.prisma.profile.findUnique({
        where: {
          id: applicantId,
        },
      });

    if (!applicant) {
      throw new NotFoundException(
        "Applicant profile not found.",
      );
    }

    if (!applicant.resumeKey) {
      throw new BadRequestException(
        "Please upload your resume before applying.",
      );
    }

    const existingApplication = await this.prisma.jobApplication.findUnique({
      where: {
        jobId_applicantId: { jobId, applicantId },
      },
    });

    if (existingApplication) {
      throw new ConflictException(`You have already submitted an application for this position. Status: ${existingApplication.status}`);
    }

    return this.prisma.jobApplication.create({
      data: {
        message:
          dto.message ??
          "Interested in joining the team.",

        status: JobApplicationStatus.pending,

        resumeKey:
          applicant.resumeKey,

        resumeFileName:
          applicant.resumeFileName,

        resumeFileSize:
          applicant.resumeFileSize,

        coverLetter:
          dto.coverLetter ?? null,

        expectedSalary:
          dto.expectedSalary ?? null,

        noticePeriod:
          dto.noticePeriod ?? null,

        portfolioUrl:
          dto.portfolioUrl ?? null,

        linkedinUrl:
          dto.linkedinUrl ??
          applicant.linkedinUrl,

        job: {
          connect: {
            id: jobId,
          },
        },

        applicant: {
          connect: {
            id: applicantId,
          },
        },
      },
    });
  }

  // 7. PATCH /jobs/:id/applications/:appId (APPROVE OR REJECT INCOMING APPLICANT)
  async processApplicationStatus(jobId: string, appId: string, status: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { job: true },
    });

    if (!app || app.jobId !== jobId) {
      throw new NotFoundException('Job application record not found for this specific position listing.');
    }

    const validStatuses = ['accepted', 'rejected', 'pending'];
    if (!validStatuses.includes(status.toLowerCase())) {
      throw new BadRequestException("Status can only be set to 'accepted', 'rejected' or 'pending'.");
    }

    const updatedApp = await this.prisma.jobApplication.update({
      where: { id: appId },
      data: { status: status as JobApplicationStatus },
    });

    // Automatically transition to the ProjectMember layout if the application is approved
    if (status.toLowerCase() === 'accepted') {
      const project = await this.prisma.project.findFirst({
        where: { name: app.job.startupName }, // Locates project container link
      });

      if (project) {
        const existingMember = await this.prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId: project.id, userId: app.applicantId },
          },
        });

        if (!existingMember) {
          await this.prisma.projectMember.create({
            data: {
              projectId: project.id,
              userId: app.applicantId,
              role: app.job.role,
            },
          });
        }
      }
    }

    return updatedApp;
  }
}
