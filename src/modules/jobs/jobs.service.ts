import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobApplicationStatus, Prisma } from '@prisma/client';
import { CreateJobDto } from "./dto/create-job.dto";
import { ApplyJobDto } from "./dto/apply-job.dto";
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { StorageType } from '../storage/enums/storage-type.enum';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // 1. GET ALL VACANCIES
  // Public browse endpoint — must never leak other applicants' application
  // data (resumes, cover letters, salary expectations, full profiles).
  // Each job's `applications` here is scoped to just the caller's own
  // entry (0 or 1) so the frontend's "did I already apply" check keeps
  // working; `applicationsCount` carries the real total safely. Anyone who
  // actually needs the full applicant list is the poster, who gets it via
  // the separately-gated myPosts()/myAnalytics() below.
  async list(userId: string) {
    const jobs = await this.prisma.job.findMany({
      include: {
        poster: { select: { id: true, fullName: true, headline: true, avatarUrl: true, role: true } },
        _count: { select: { applications: true } },
        applications: { where: { applicantId: userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      relationLoadStrategy: 'join',
    });

    return jobs.map(({ _count, ...job }) => ({ ...job, applicationsCount: _count.applications }));
  }

  // Real pagination + server-side search/role filtering for the mobile
  // Jobs browse screen, as a separate endpoint from list() above — list()
  // is called unpaginated from web/admin too, so changing its response
  // shape would break those. This is the same fix as Discover's: the old
  // path fetched list()'s capped 100 once and did search + role filtering
  // client-side; jobs past the 100th newest were invisible/unsearchable.
  async browse(userId: string, page: number, limit: number, query?: string, role?: string) {
    const searchTerm = query?.trim();

    const where: Prisma.JobWhereInput = {
      ...(role && role !== 'all' ? { role } : {}),
      // heading/startupName/role/experience/description cover the common
      // searches — skills is a string array, and Postgres/Prisma can't do
      // substring matching inside array elements without raw SQL, so
      // exact-tag search on it (previously done client-side) isn't
      // included here.
      ...(searchTerm
        ? {
            OR: [
              { heading: { contains: searchTerm, mode: 'insensitive' } },
              { startupName: { contains: searchTerm, mode: 'insensitive' } },
              { role: { contains: searchTerm, mode: 'insensitive' } },
              { experience: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [jobs, totalCount] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: {
          poster: { select: { id: true, fullName: true, headline: true, avatarUrl: true, role: true } },
          _count: { select: { applications: true } },
          applications: { where: { applicantId: userId } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        relationLoadStrategy: 'join',
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs: jobs.map(({ _count, ...job }) => ({ ...job, applicationsCount: _count.applications })),
      totalCount,
      hasMore: page * limit < totalCount,
    };
  }

  // 2. GET SINGLE JOB DETAILS
  // Same scoping as list() — see comment above.
  async findOne(id: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        poster: { select: { id: true, fullName: true, headline: true, avatarUrl: true, role: true } },
        _count: { select: { applications: true } },
        applications: { where: { applicantId: userId } },
      },
    });
    if (!job) throw new NotFoundException(`Job listing with ID ${id} not found`);
    const { _count, ...rest } = job;
    return { ...rest, applicationsCount: _count.applications };
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
  "service_provider",
];

if (!allowedRoles.includes(profile.role)) {
  throw new ForbiddenException(
    "Only founders, co-founders, investors, HR and service providers can post jobs.",
  );
}

    return this.prisma.job.create({
      data: {
        startupName: dto.startupName,
        heading: dto.heading,
        role: dto.role || "other",
        experience: dto.experience || "Not specified",
        location: dto.location || "",
        openings: dto.openings ?? 1,
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
        location: dto.location,
        openings: dto.openings,
        skills: dto.skills,
        description: dto.description,
      },
    });
  }

  // 5. DELETE A VACANCY
  async removeJob(id: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { applications: true },
    });
    if (!job) throw new NotFoundException('Job listing not found');

    if (job.posterId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this job post.');
    }

    if (job.applications.length > 0) {
      throw new ConflictException('This job post already has applications and can no longer be deleted.');
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

    const application = await this.prisma.jobApplication.create({
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

    await this.notifications.createNotification(
      job.posterId,
      'JOB_ALERT',
      'New job application',
      `You have a new applicant for ${job.heading}.`,
    );

    return application;
  }

  // 7. PATCH /jobs/:id/applications/:appId (APPROVE OR REJECT INCOMING APPLICANT)
  async processApplicationStatus(jobId: string, appId: string, status: string, userId: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { job: true },
    });

    if (!app || app.jobId !== jobId) {
      throw new NotFoundException('Job application record not found for this specific position listing.');
    }

    if (app.job.posterId !== userId) {
      throw new ForbiddenException('You do not have permission to manage applications for this job post.');
    }

    const validStatuses = ['accepted', 'rejected', 'pending'];
    if (!validStatuses.includes(status.toLowerCase())) {
      throw new BadRequestException("Status can only be set to 'accepted', 'rejected' or 'pending'.");
    }

    const updatedApp = await this.prisma.jobApplication.update({
      where: { id: appId },
      data: { status: status as JobApplicationStatus },
    });

    if (status.toLowerCase() === 'accepted' || status.toLowerCase() === 'rejected') {
      await this.notifications.createNotification(
        app.applicantId,
        'APPLICATION_STATUS',
        `Application ${status.toLowerCase()}`,
        `Your application for ${app.job.heading} was ${status.toLowerCase()}.`,
      );
    }

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

  // 7b. GET /jobs/:id/applications/:appId/resume (OWNER OR APPLICANT ONLY)
  async getApplicationResumeUrl(jobId: string, appId: string, userId: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { job: true },
    });

    if (!app || app.jobId !== jobId) {
      throw new NotFoundException('Job application record not found for this specific position listing.');
    }

    const isOwner = app.job.posterId === userId;
    const isApplicant = app.applicantId === userId;

    if (!isOwner && !isApplicant) {
      throw new ForbiddenException('You do not have permission to view this resume.');
    }

    if (!app.resumeKey) {
      throw new NotFoundException('No resume was attached to this application.');
    }

    const url = await this.storage.getSignedUrl(StorageType.RESUME, app.resumeKey);
    return { url, fileName: app.resumeFileName };
  }

  // 8. GET /jobs/mine/applications (JOBSEEKER VIEW)
  async myApplications(applicantId: string) {
    return this.prisma.jobApplication.findMany({
      where: { applicantId },
      include: { job: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 9. GET /jobs/mine/posts (FOUNDER / HR VIEW)
  async myPosts(posterId: string) {
    return this.prisma.job.findMany({
      where: { posterId },
      include: { applications: { include: { applicant: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 10. GET /jobs/mine/analytics (FOUNDER / HR VIEW)
  async myAnalytics(posterId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { posterId },
      include: { applications: true },
    });

    let totalApplications = 0;
    let accepted = 0;
    let rejected = 0;
    let pending = 0;

    for (const job of jobs) {
      for (const application of job.applications) {
        totalApplications += 1;
        if (application.status === JobApplicationStatus.accepted) accepted += 1;
        else if (application.status === JobApplicationStatus.rejected) rejected += 1;
        else pending += 1;
      }
    }

    return {
      totalPosts: jobs.length,
      totalApplications,
      accepted,
      rejected,
      pending,
      onboardCount: accepted,
      perJob: jobs.map((job) => ({
        jobId: job.id,
        heading: job.heading,
        applicationCount: job.applications.length,
        accepted: job.applications.filter((a) => a.status === JobApplicationStatus.accepted).length,
        rejected: job.applications.filter((a) => a.status === JobApplicationStatus.rejected).length,
      })),
    };
  }
}
