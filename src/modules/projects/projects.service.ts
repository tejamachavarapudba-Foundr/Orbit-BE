import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service'; // Adjust relative path based on your folder setup
import { MemberRole, ApplicationStatus, JobApplicationStatus, NotificationType, Prisma, ProjectStage } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { StorageType } from '../storage/enums/storage-type.enum';

@Injectable()
export class ProjectsService {
  // Inject NotificationsService alongside PrismaService
  constructor(
    private readonly  prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  async list(userId?: string) {
    const projects = await this.prisma.project.findMany({
      include: {
        // Summary only — the full snapshot (financials, cap table, KYC docs)
        // is served exclusively by GET /investor-snapshot/project/:id, which
        // enforces owner-or-investor access. Never expand this to `true`.
        investorSnapshot: { select: { isCompleted: true, completionPercentage: true } },
        owner: { select: { founderVerification: { select: { status: true } } } },
        _count: { select: { likedBy: true, members: true } },
        likedBy: userId ? { where: { userId }, select: { id: true } } : false,
        viewedBy: userId ? { where: { userId }, select: { id: true } } : false,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      relationLoadStrategy: 'join',
    });

    return projects.map((project: any) => ({
      ...project,
      founderVerified: project.owner?.founderVerification?.status === 'approved',
      owner: undefined,
      likeCount: project._count?.likedBy ?? 0,
      // Real roster count, not the self-reported teamSize field — those two
      // used to disagree (card said "Team 1" from teamSize's default while
      // the detail screen's actual member list showed 0).
      teamMemberCount: project._count?.members ?? 0,
      isLikedByMe: Boolean(project.likedBy?.length),
      isViewedByMe: Boolean(project.viewedBy?.length),
      _count: undefined,
      likedBy: undefined,
      viewedBy: undefined,
    }));
  }

  // Real pagination + server-side search/stage/type filtering for the
  // Projects & startups screen, as a separate endpoint from list() above —
  // list() is called unpaginated from web/admin too, so changing its
  // response shape would break those. Same fix as Discover/Jobs/Events:
  // list()'s capped 100 with search/filtering done entirely client-side
  // meant anything past the 100th newest project was invisible and
  // unsearchable, not just a perf issue.
  async browse(userId: string, page: number, limit: number, query?: string, stage?: string, projectType?: string) {
    const searchTerm = query?.trim();

    const where: Prisma.ProjectWhereInput = {
      ...(stage && stage !== 'all' ? { stage: stage as ProjectStage } : {}),
      ...(projectType && projectType !== 'all' ? { projectType } : {}),
      // name/tagline/description/location cover the common searches —
      // techStack/lookingFor/industryTags are string arrays, and
      // Postgres/Prisma can't do substring matching inside array elements
      // without raw SQL, so exact-tag search on those (previously done
      // client-side) isn't included here.
      ...(searchTerm
        ? {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { tagline: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
              { location: { contains: searchTerm, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [projects, totalCount] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: {
          investorSnapshot: { select: { isCompleted: true, completionPercentage: true } },
          owner: { select: { founderVerification: { select: { status: true } } } },
          _count: { select: { likedBy: true, members: true } },
          likedBy: userId ? { where: { userId }, select: { id: true } } : false,
          viewedBy: userId ? { where: { userId }, select: { id: true } } : false,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        relationLoadStrategy: 'join',
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      projects: projects.map((project: any) => ({
        ...project,
        founderVerified: project.owner?.founderVerification?.status === 'approved',
        owner: undefined,
        likeCount: project._count?.likedBy ?? 0,
        teamMemberCount: project._count?.members ?? 0,
        isLikedByMe: Boolean(project.likedBy?.length),
        isViewedByMe: Boolean(project.viewedBy?.length),
        _count: undefined,
        likedBy: undefined,
        viewedBy: undefined,
      })),
      totalCount,
      hasMore: page * limit < totalCount,
    };
  }

  async listReels(userId: string, cursor?: string, limit = 10) {
    const projects = await this.prisma.project.findMany({
      where: { pitchVideoUrl: { not: '' } },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        tagline: true,
        logoUrl: true,
        pitchVideoUrl: true,
        ownerId: true,
        createdAt: true,
        _count: { select: { likedBy: true, comments: true } },
        likedBy: userId ? { where: { userId }, select: { id: true } } : false,
        savedBy: userId ? { where: { userId }, select: { id: true } } : false,
      },
    });

    const items = projects.map((project: any) => ({
      id: project.id,
      name: project.name,
      tagline: project.tagline,
      logoUrl: project.logoUrl,
      pitchVideoUrl: project.pitchVideoUrl,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      likeCount: project._count?.likedBy ?? 0,
      commentCount: project._count?.comments ?? 0,
      isLikedByMe: Boolean(project.likedBy?.length),
      isSavedByMe: Boolean(project.savedBy?.length),
    }));

    const nextCursor = projects.length === limit ? projects[projects.length - 1].id : null;

    return { items, nextCursor };
  }

  async toggleLike(userId: string, projectId: string) {
    const existing = await this.prisma.startupLike.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (existing) {
      await this.prisma.startupLike.delete({ where: { id: existing.id } });
      return { liked: false };
    }

    await this.prisma.startupLike.create({ data: { userId, projectId } });
    return { liked: true };
  }

  async markViewed(userId: string, projectId: string) {
    await this.prisma.startupView.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: {},
      create: { userId, projectId },
    });
    return { viewed: true };
  }

  async create(userId: string, dto: any) {
  const hasIncorporationDoc = Boolean(dto.incorporationDocUrl?.trim());
  const hasIncorporationReason = Boolean(dto.incorporationReason?.trim());
  if (!hasIncorporationDoc && !hasIncorporationReason) {
    throw new BadRequestException(
      'Provide a Certificate of Incorporation file or a reason before publishing.',
    );
  }

  return this.prisma.project.create({
    data: {
      name: dto.name,
      tagline: dto.tagline ?? "",
      description: dto.description ?? "",
      pitch: dto.pitch ?? "",
      category: dto.category ?? "",

      industryTags: dto.industryTags ?? [],

      projectType: dto.projectType,
      stage: dto.stage,
      fundingStage: dto.fundingStage,

      teamSize: dto.teamSize ?? 1,
      foundedYear: dto.foundedYear,

      location: dto.location ?? "",

      websiteUrl: dto.websiteUrl ?? "",
      demoUrl: dto.demoUrl ?? "",

      pitchDeckUrl: dto.pitchDeckUrl ?? "",
      pitchVideoUrl: dto.pitchVideoUrl ?? "",
      askAmount: dto.askAmount ?? "",
      equityPercent: dto.equityPercent ?? "",

      githubUrl: dto.githubUrl ?? "",
      twitterUrl: dto.twitterUrl ?? "",
      linkedinUrl: dto.linkedinUrl ?? "",

      logoUrl: dto.logoUrl ?? "",
      coverUrl: dto.coverUrl ?? "",

      techStack: dto.techStack ?? [],
      lookingFor: dto.lookingFor ?? [],

      isPublished: dto.isPublished ?? false,

      cinNumber: dto.cinNumber ?? "",
      dpiitNumber: dto.dpiitNumber ?? "",

      incorporationDocUrl: dto.incorporationDocUrl ?? "",
      incorporationDocKey: dto.incorporationDocKey ?? "",
      incorporationReason: dto.incorporationReason ?? "",
      // Content is guaranteed present (checked above), so this always
      // starts pending — nothing to review is not a state that can happen.
      incorporationVerificationStatus: 'pending',

      owner: {
        connect: {
          id: userId
        }
      }
    }
  });
}

  // 1. SECURED UPDATE METHOD
  async update(id: string, userId: string, dto: any) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    // SECURITY CHECK: Verify ownership
    if (project.ownerId !== userId) {
      throw new ForbiddenException("Permission denied: You cannot update a project that belongs to another user");
    }

    // Fix enum serialization error (Converts hyphens to underscores but preserves lowercase)
    let workingStage = dto.stage;
    if (workingStage && typeof workingStage === 'string') {
      workingStage = workingStage.replace('-', '_').toLowerCase();
    }

    // If the incorporation doc/reason is being changed, that's new content
    // an admin hasn't seen yet — back to pending, same as a fresh
    // submission, regardless of whatever the project was previously
    // approved/rejected as.
    const incorporationChanged =
      ('incorporationDocUrl' in dto && dto.incorporationDocUrl !== project.incorporationDocUrl) ||
      ('incorporationReason' in dto && dto.incorporationReason !== project.incorporationReason);

    try {
      const updatedProject =
        await this.prisma.project.update({
          where: { id },
          data: {
            ...dto,
            stage: workingStage
              ? (workingStage as any)
              : undefined,
            projectType: dto.projectType
              ? (dto.projectType as any)
              : undefined,
            ...(incorporationChanged && {
              incorporationVerificationStatus: 'pending',
              incorporationReviewedBy: null,
              incorporationReviewNotes: null,
              incorporationReviewedAt: null,
            }),
          },
       });

     // Startup published notification
     if (
       !project.isPublished &&
       updatedProject.isPublished
     ) {
       const investors =
         await this.prisma.user.findMany({
           where: {
             profile: {
               role: {
                 in: ["investor", "advisor"],
                },
              },
           },
           // Only .id is used below — no need to pull passwordHash,
           // refreshHash, or any other column for every investor/advisor.
           select: { id: true },
          });

        await this.notificationsService.createBulkNotification(
          investors.map((investor) => investor.id),
          NotificationType.SYSTEM_ALERT,
          "New Startup Published",
          `${updatedProject.name} is now available for review.`
        );
    }

    return updatedProject;
  } catch (error) {
    throw error;
  }
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }
 
  // 2. SECURED REMOVE METHOD
  async remove(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    // SECURITY CHECK: Verify ownership
    if (project.ownerId !== userId) {
      throw new ForbiddenException("Permission denied: You cannot delete a project that belongs to another user");
    }

    return await this.prisma.project.delete({
      where: { id },
    });
  }

  // ==========================================
  // JOB CREATION ENGINE (SECURED)
  // ==========================================
  async createJob(projectId: string, posterId: string, dto: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    // SECURITY CHECK: Ensure only the creator can post open job vacancies
    if (project.ownerId !== posterId) {
      throw new ForbiddenException("Permission denied: You cannot list job postings for a project you don't own");
    }

    return await this.prisma.job.create({
      data: {
        startupName: project.name,
        heading: dto.heading || `Looking for a ${dto.role}`,
        role: dto.role,
        experience: dto.experience || "Not specified",
        skills: dto.skills || [],
        description: dto.description || "",
        poster: { connect: { id: posterId } },
      }
    });
  }

  // ==========================================
  // APPLICATION SUBMISSION ENGINE
  // ==========================================
  async addApplication(projectId: string, userId: string, dto: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const ownerId = project.ownerId; 
    if (ownerId === userId) {
      throw new BadRequestException('You cannot submit an application to a project you already own.');
    }

    let resolvedRole = dto.role || "";
    if (resolvedRole === 'engineer') resolvedRole = 'software_engineer';

    const isOwnerType = resolvedRole === 'co_founder' || resolvedRole === 'investor' || resolvedRole === 'founder';

    if (isOwnerType) {
      const existingApp = await this.prisma.projectApplication.findUnique({
        where: {
          projectId_applicantId: { projectId, applicantId: userId }
        }
      });

      if (existingApp) {
        throw new ConflictException(`You have already submitted a partner application for this project. Current status: ${existingApp.status}`);
      }

      return await this.prisma.projectApplication.create({
        data: {
          role: resolvedRole,
          message: dto.message || "Interested in joining as partner",
          status: ApplicationStatus.pending,
          project: { connect: { id: projectId } },
          applicant: { connect: { id: userId } }
        }
      });
    }

    const targetJobId = dto.jobId || dto.job_id;
    if (!targetJobId) {
      throw new BadRequestException(`Employee applications for '${resolvedRole}' must supply a valid jobId.`);
    }

    const jobExists = await this.prisma.job.findUnique({ where: { id: targetJobId } });
    if (!jobExists) throw new NotFoundException('The requested job position does not exist.');

    const existingJobApp = await this.prisma.jobApplication.findUnique({
      where: {
        jobId_applicantId: { jobId: targetJobId, applicantId: userId }
      }
    });

    if (existingJobApp) {
      throw new ConflictException(`You have already applied for this specific job listing. Current status: ${existingJobApp.status}`);
    }

    return await this.prisma.jobApplication.create({
      data: {
        message: dto.message || "Applying for open position",
        status: JobApplicationStatus.pending,
        job: { connect: { id: targetJobId } },
        applicant: { connect: { id: userId } }
      }
    });
  }

  async getApplicationsByRole(projectId: string, userId: string, role?: MemberRole) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project reference not found');

    // SECURITY CHECK: Only the project owner can view who applied
    if (project.ownerId !== userId) {
      throw new ForbiddenException("Permission denied: You cannot view applications for a project you don't own");
    }

    const directPartners = await this.prisma.projectApplication.findMany({
      where: {
        projectId: projectId,
        ...(role ? { role: role as string } : {})
      },
      include: { applicant: { omit: { fcmTokens: true, resumeKey: true } } }
    });

    const jobEmployees = await this.prisma.jobApplication.findMany({
      where: {
        job: {
          ...({ projectId: projectId } as any),
          ...({ project_id: projectId } as any),
          ...(role ? { role: role as string } : {})
        }
      },
      include: {
        applicant: { omit: { fcmTokens: true, resumeKey: true } },
        job: true
      }
    });

    return { partners: directPartners, employees: jobEmployees };
  }

  // ==========================================
  // APPLICATION APPROVAL ENGINE (SECURED)
  // ==========================================
  async processApplicationStatus(projectId: string, userId: string, appId: string, dto: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project reference not found');

    // SECURITY CHECK: Only the project owner can accept/reject applicants
    if (project.ownerId !== userId) {
      throw new ForbiddenException("Permission denied: You cannot process applications for a project you don't own");
    }

    const { type, status } = dto; 

    if (type === 'PARTNER') {
      const app = await this.prisma.projectApplication.findUnique({ where: { id: appId } });
      if (!app) throw new NotFoundException('Partner application not found');

      const updatedApp = await this.prisma.projectApplication.update({
        where: { id: appId },
        data: { status: status as ApplicationStatus, respondedAt: new Date() }
      });

      if (status === 'accepted') {
        await this.addMemberIfUnique(projectId, app.applicantId, app.role);
      }

      // 🔴 SCENARIO B HOOK: Send Partner application status update alert
      try {
        await this.notificationsService.createNotification(
          app.applicantId,
          'APPLICATION_STATUS' as any,
          'Partner Application Update',
          `Your application to join "${project.name}" as a ${app.role} has been ${status}.`
        );
      } catch (err) {
        console.error('Notification dispatch failed for partner application status update:', err);
      }

      return updatedApp;
    }
    
    if (type === 'EMPLOYEE') {
      const app = await this.prisma.jobApplication.findUnique({ 
        where: { id: appId },
        include: { job: true }
      });
      if (!app) throw new NotFoundException('Job application not found');

      const updatedApp = await this.prisma.jobApplication.update({
        where: { id: appId },
        data: { status: status as JobApplicationStatus }
      });

      if (status === 'accepted') {
        await this.addMemberIfUnique(projectId, app.applicantId, app.job.role);
      }

      // 🔴 SCENARIO B HOOK: Send Job application status update alert
      try {
        await this.notificationsService.createNotification(
          app.applicantId,
          'APPLICATION_STATUS' as any,
          'Job Application Update',
          `Your application for the position "${app.job.role}" at "${project.name}" has been ${status}.`
        );
      } catch (err) {
        console.error('Notification dispatch failed for employee application status update:', err);
      }

      return updatedApp;
    }

    throw new BadRequestException("Invalid type specification. Use 'PARTNER' or 'EMPLOYEE'.");
  }

  private async addMemberIfUnique(projectId: string, userId: string, role: string) {

    const existingMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });
    if (!existingMember) {
      return this.prisma.projectMember.create({
        data: { projectId, userId, role }
      });
    }
  }

    // Fetch all registered team members for a specific project
  async getProjectMembers(projectId: string) {
    // 1. Verify the project exists
    const projectExists = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!projectExists) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // 2. Pull all members and map their details
    return this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        id: true,         // The membership record ID
        role: true,       // Their role (e.g. PARTNER, EMPLOYEE)
        userId: true,     // The Member's User ID
        
      }
    });
  }

  async saveStartup(userId: string, projectId: string) {
    return this.prisma.savedStartup.upsert({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
      update: {},
      create: {
        userId,
        projectId,
     },
   });
  }

  async unsaveStartup(userId: string, projectId: string) {
    return this.prisma.savedStartup.delete({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });
  }

  async getSavedStartups(userId: string) {
    return this.prisma.savedStartup.findMany({
      where: {
        userId,
      },
        include: {
        project: {
          include: {
            // Summary only — see note in list() above.
            investorSnapshot: { select: { isCompleted: true, completionPercentage: true } },
            members: {
              include: {
                user: { omit: { fcmTokens: true, resumeKey: true } },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async updateLogo(
  projectId: string,
  userId: string,
  file: Express.Multer.File,
) {
  const project =
    await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

  if (!project) {
    throw new NotFoundException(
      'Project not found',
    );
  }

  if (project.ownerId !== userId) {
    throw new ForbiddenException(
      'Permission denied.',
    );
  }

  const upload =
    await this.storageService.upload(
      file,
      StorageType.PROJECT,
      project.id,
    );

  if (project.logoUrl) {
    try {
      const oldPath =
        this.storageService.extractPathFromUrl(
          project.logoUrl,
        );

      if (oldPath) {
        await this.storageService.delete(
          StorageType.PROJECT,
          oldPath,
        );
      }
    } catch (error) {
      console.warn(
        'Failed to delete previous project logo',
        error,
      );
    }
  }

  return this.prisma.project.update({
    where: {
      id: project.id,
    },
    data: {
      logoUrl: upload.url,
    },
  });
  }

  async updateCover(projectId: string, userId: string, file: Express.Multer.File) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('Permission denied.');
    }

    const upload = await this.storageService.upload(file, StorageType.PROJECT, project.id);

    if (project.coverUrl) {
      try {
        const oldPath = this.storageService.extractPathFromUrl(project.coverUrl);
        if (oldPath) {
          await this.storageService.delete(StorageType.PROJECT, oldPath);
        }
      } catch (error) {
        console.warn('Failed to delete previous project cover', error);
      }
    }

    return this.prisma.project.update({
      where: { id: project.id },
      data: { coverUrl: upload.url },
    });
  }

  async updatePitchVideo(projectId: string, userId: string, file: Express.Multer.File) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('Permission denied.');
    }

    const upload = await this.storageService.upload(file, StorageType.PROJECT, project.id);

    if (project.pitchVideoUrl) {
      try {
        const oldPath = this.storageService.extractPathFromUrl(project.pitchVideoUrl);
        if (oldPath) {
          await this.storageService.delete(StorageType.PROJECT, oldPath);
        }
      } catch (error) {
        console.warn('Failed to delete previous pitch video', error);
      }
    }

    return this.prisma.project.update({
      where: { id: project.id },
      data: { pitchVideoUrl: upload.url },
    });
  }

}
