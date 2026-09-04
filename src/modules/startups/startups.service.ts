import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StartupsService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 1. FILTER MULTIPLE STAGES AT A TIME
  // ==========================================
  async findAllStartups(query: { page?: number; limit?: number; stage?: string | string[]; industry?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    let stageFilter: any = undefined;

    if (query.stage) {
      if (Array.isArray(query.stage)) {
        stageFilter = { in: query.stage };
      } else if (query.stage.includes(',')) {
        stageFilter = { in: query.stage.split(',') };
      } else {
        stageFilter = query.stage;
      }
    }

    const startups = await this.prisma.project.findMany({
      where: {
        stage: stageFilter,
        // Fixes TS2353: Wraps projectType/industry dynamically to bypass strict schema keys
        ...({ projectType: query.industry || undefined } as any),
        ...({ industry: query.industry || undefined } as any)
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { founderVerification: { select: { status: true } } } },
      },
    });

    return startups.map((startup: any) => ({
      ...startup,
      founderVerified: startup.owner?.founderVerification?.status === 'approved',
      owner: undefined,
    }));
  }

  // ==========================================
  // 2. CONDITION TO FILTER TRENDING STARTUPS
  // ==========================================
  // Trending is purely reviews-based: more reviews and a higher average
  // rating score higher, with the same time-decay (Hacker News style
  // gravity) applied so recent review activity outranks an old startup
  // coasting on reviews from months ago. Applications, posts/likes/
  // comments, team size, and stage no longer factor in at all.
  async findTrending(limit: number = 10) {
    const startups = await this.prisma.project.findMany({
      include: {
        // Summary only — see note in projects.service.ts's list().
        investorSnapshot: { select: { isCompleted: true, completionPercentage: true } },
        owner: { select: { founderVerification: { select: { status: true } } } },
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } }
      }
    });

    const now = new Date().getTime();

    const scoredStartups = startups.map((startup: any) => {
      const reviewCount = startup._count?.reviews || 0;
      const totalRatingSum = startup.reviews?.reduce((sum: number, r: any) => sum + r.rating, 0) || 0;
      const avgRating = reviewCount > 0 ? totalRatingSum / reviewCount : 0;

      const totalBaseScore = (reviewCount * 15) + (avgRating * 30);

      const postAgeInHours = Math.abs(now - new Date(startup.createdAt).getTime()) / (1000 * 60 * 60);
      const gravity = 1.8;
      const decayedTrendingScore = totalBaseScore / Math.pow(postAgeInHours + 2, gravity);

      return {
        ...startup,
        reviews: undefined,
        founderVerified: startup.owner?.founderVerification?.status === 'approved',
        owner: undefined,
        baseScore: parseFloat(totalBaseScore.toFixed(2)),
        trendingScore: parseFloat(decayedTrendingScore.toFixed(4))
      };
    });

    return scoredStartups
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  }

  // ==========================================
  // 3. FIND ONE STARTUP DETAILED VIEW
  // ==========================================
  async findOne(id: string) {
    const startup = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { include: { founderVerification: true } }, // Includes the founder profile details
        applications: true, // Includes partner applications
        posts: true,        // Includes social updates feed
        reviews: true,      // Includes 1-5 star ratings

        // Summary only — see note in projects.service.ts's list().
        investorSnapshot: { select: { isCompleted: true, completionPercentage: true } },

        members: {          // Fixes: Unknown field ProjectMember
          include: {
            user: true      // Fetches the user profile for each team member
          }
        }
      }
    });

    if (!startup) {
      throw new NotFoundException(`Startup with ID ${id} not found`);
    }

    return {
      ...startup,
      founderVerified: (startup.owner as any)?.founderVerification?.status === 'approved',
    };
  }

  // ==========================================
  // 4. SUBMIT AND CREATE PROJECT REVIEW
  // ==========================================
  async addProjectReview(projectId: string, reviewerId: string, dto: { rating: number; comment?: string }) {
    // A. Confirm target project entry exists
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Startup project not found');

    // B. Business Integrity Rule: Prevent owners from giving themselves reviews
    if (project.ownerId === reviewerId) {
      throw new BadRequestException('You cannot write a verification review for your own startup.');
    }

    // C. Validation Constraint: Enforce 1-5 stars scale parameters
    const rating = Number(dto.rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating metric must be an integer value between 1 and 5 stars.');
    }

    // D. Multi-submission Guard: Check if this user already submitted a review
    const existingReview = await this.prisma.projectReview.findUnique({
      where: {
        projectId_reviewerId: { projectId, reviewerId }
      }
    });

    if (existingReview) {
      throw new ConflictException('You have already submitted a qualitative review validation for this project.');
    }

    // E. Execute insertion query write logic cleanly
    return await this.prisma.projectReview.create({
      data: {
        rating,
        comment: dto.comment || "",
        project: { connect: { id: projectId } },
        reviewer: { connect: { id: reviewerId } }
      }
    });
  }

  async getInvestorDiscovery() {
    const startups = await this.prisma.project.findMany({
      where: {
        investorSnapshot: {
          isCompleted: true,
        },
      },

      include: {
        // Summary only — the full snapshot is served exclusively by
        // GET /investor-snapshot/project/:id, which enforces owner-or-investor
        // access with compliance-doc redaction. Never expand this to `true`.
        investorSnapshot: { select: { isCompleted: true, completionPercentage: true } },
        owner: { select: { founderVerification: { select: { status: true } } } },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return startups.map((startup: any) => ({
      ...startup,
      founderVerified: startup.owner?.founderVerification?.status === 'approved',
      owner: undefined,
    }));
  }
}
