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

    return await this.prisma.project.findMany({
      where: {
        stage: stageFilter,
        // Fixes TS2353: Wraps projectType/industry dynamically to bypass strict schema keys
        ...({ projectType: query.industry || undefined } as any),
        ...({ industry: query.industry || undefined } as any)
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 2. CONDITION TO FILTER TRENDING STARTUPS
  // ==========================================
  async findTrending(limit: number = 10) {
    // 1. Fetch startups using only valid, lowercase schema relation names
    const startups = await this.prisma.project.findMany({
      include: {
        _count: {
          select: {
            applications: true, // Core direct partner requests count
            members: true,      // Core team assembly count
            reviews: true       // High-integrity rating review count
          }
        },
        reviews: {
          select: { rating: true }
        },
        posts: {
          include: {
            _count: {
              select: {
                likes: true,
                comments: true
              }
            }
          }
        }
      }
    });

    const now = new Date().getTime();

    const scoredStartups = startups.map((startup: any) => {
      // Extract interaction count variables cleanly
      const applicationCount = startup._count?.applications || 0;
      const reviewCount = startup._count?.reviews || 0;
      const memberCount = startup._count?.members || 0;

      // Compute precise rating point values
      const totalRatingSum = startup.reviews?.reduce((sum: number, r: any) => sum + r.rating, 0) || 0;
      const avgRating = reviewCount > 0 ? (totalRatingSum / reviewCount) : 0;

      // Extract linked social metrics feed counts
      let linkedPostLikes = 0;
      let linkedPostComments = 0;

      if (startup.posts && startup.posts.length > 0) {
        startup.posts.forEach((post: any) => {
          linkedPostLikes += post._count?.likes || 0;
          linkedPostComments += post._count?.comments || 0;
        });
      }

      // Calculate base engagement weights
      const validationPoints =
        (applicationCount * 25) +   // Partner request conversion track (25 pts)
        (reviewCount * 15) +        // Raw direct user verification reviews (15 pts)
        (avgRating * 30) +          // Product performance value index (Max 150 pts)
        (linkedPostLikes * 5) +     // Public interest visibility points (5 pts)
        (linkedPostComments * 8) +  // Conversation density engagement points (8 pts)
        (memberCount * 5);          // Team tracking baseline score weight

      // Early-stage visibility multiplier boost (Ideas/MVPs scale up higher)
      let stageBonusMultiplier = 1.0;
      const currentStage = (startup.stage || '').toUpperCase();
      if (currentStage === 'IDEA') stageBonusMultiplier = 1.5;
      if (currentStage === 'MVP') stageBonusMultiplier = 1.2;

      const totalBaseScore = validationPoints * stageBonusMultiplier;

      // Exponential Time Decay gravity penalty mapping (Hacker News framework)
      const postAgeInHours = Math.abs(now - new Date(startup.createdAt).getTime()) / (1000 * 60 * 60);
      const gravity = 1.8;
      
      const decayedTrendingScore = totalBaseScore / Math.pow((postAgeInHours + 2), gravity);

      return {
        ...startup,
        posts: undefined, // Strips deep arrays from the response payload for a clean look
        reviews: undefined,
        baseScore: parseFloat(totalBaseScore.toFixed(2)),
        trendingScore: parseFloat(decayedTrendingScore.toFixed(4))
      };
    });

    // 2. Sort descending by highest time-decayed trending index calculation
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
        owner: true,        // Includes the founder profile details
        applications: true, // Includes partner applications
        posts: true,        // Includes social updates feed
        reviews: true,      // Includes 1-5 star ratings
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
    return startup;
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
}
