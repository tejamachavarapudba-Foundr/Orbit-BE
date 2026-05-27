import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface SearchOptions {
  keyword: string;
  type: string;
  roleFilter?: string;
  stageFilter?: string;
  categoryFilter?: string;
  limit: number;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async list(keyword: string, type: string, roleFilter: string | undefined, limit: number, stageFilter?: string, categoryFilter?: string) {
    // Strict wildcard config for real-time keystroke matching
    const textMatch = {
      contains: keyword,
      mode: 'insensitive' as const,
    };

    // 1. DOMAIN MAPPING & SANITIZATION ENGINE
    const cleanRole = (roleFilter && roleFilter.toLowerCase() !== 'all roles') 
      ? roleFilter.replace('-', '_').replace(' ', '_').toLowerCase() 
      : undefined;

    const cleanStage = (stageFilter && stageFilter.toLowerCase() !== 'all stages') 
      ? stageFilter.replace('-', '_').replace(' ', '_').toLowerCase() 
      : undefined;

    const cleanCategory = (categoryFilter && categoryFilter.toLowerCase() !== 'all types') 
      ? categoryFilter.replace('-', '_').replace(' ', '_').toLowerCase() 
      : undefined;

    let resolvedType = type.toLowerCase().trim();
    if (resolvedType.includes('|')) resolvedType = 'all';

    // ==========================================
    // 2. NETWORK SEARCH ROUTE (SCREEN 1)
    // ==========================================
    if (resolvedType === 'users') {
      return this.prisma.user.findMany({
        where: {
          AND: [
            cleanRole ? { role: { equals: cleanRole as any } } : {},
            {
              OR: [
                { email: textMatch },
                {
                  profile: {
                    OR: [
                      { fullName: textMatch },
                      { bio: textMatch },
                    ]
                  }
                }
              ]
            }
          ]
        },
        include: { profile: true },
        take: limit,
      });
    }

    // ==========================================
    // 3. PROJECT / REQUIREMENT SEARCH ROUTE (SCREENS 2, 3, 4)
    // ==========================================
    if (resolvedType === 'projects') {
      return this.prisma.project.findMany({
        where: {
          AND: [
            cleanStage ? { stage: { equals: cleanStage as any } } : {},
            cleanCategory ? { projectType: { equals: cleanCategory as any } } : {},
            {
              OR: [
                { name: textMatch },
                { tagline: textMatch },
                { description: textMatch },
                { location: textMatch },
                { category: textMatch },
                // Array matching: Searches structural tags or co-founder requirements character-by-character
                { industryTags: { hasSome: [keyword] } },
                { techStack: { hasSome: [keyword] } },
                { lookingFor: { hasSome: [keyword] } },
              ]
            }
          ]
        },
        take: limit,
      });
    }

    // ==========================================
    // 4. COMBINED UNIVERSAL FALLBACK
    // ==========================================
    const [users, projects] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { email: textMatch },
            { profile: { OR: [{ fullName: textMatch }] } }
          ]
        },
        include: { profile: true },
        take: limit,
      }),
      this.prisma.project.findMany({
        where: {
          OR: [
            { name: textMatch },
            { tagline: textMatch },
            { description: textMatch }
          ]
        },
        take: limit,
      }),
    ]);

    return { users, projects, jobs: [] };
  }
}
