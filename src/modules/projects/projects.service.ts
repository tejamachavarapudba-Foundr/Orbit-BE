import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service'; // Adjust relative path based on your folder setup
import { MemberRole, ApplicationStatus, JobApplicationStatus, NotificationType } from '@prisma/client'; 
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

  async list() {
  return this.prisma.project.findMany({
    include: {
      investorSnapshot: true,
    },
  });
}

  async create(userId: string, dto: any) {
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

      githubUrl: dto.githubUrl ?? "",
      twitterUrl: dto.twitterUrl ?? "",
      linkedinUrl: dto.linkedinUrl ?? "",

      logoUrl: dto.logoUrl ?? "",
      coverUrl: dto.coverUrl ?? "",

      techStack: dto.techStack ?? [],
      lookingFor: dto.lookingFor ?? [],

      isPublished: dto.isPublished ?? false,

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
          });

        for (const investor of investors) {
          await this.notificationsService.createNotification(
            investor.id,
            NotificationType.SYSTEM_ALERT,
            "New Startup Published",
            `${updatedProject.name} is now available for review.`
          );
        }
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

  async getApplicationsByRole(projectId: string, role?: MemberRole) {
    const directPartners = await this.prisma.projectApplication.findMany({
      where: {
        projectId: projectId,
        ...(role ? { role: role as string } : {})
      },
      include: { applicant: true }
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
        applicant: true,
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
            investorSnapshot: true,
            members: {
              include: {
                user: true,
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

}
