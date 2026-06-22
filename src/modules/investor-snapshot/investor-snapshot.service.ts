import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvestorSnapshotService {
  constructor(private prisma: PrismaService) {}

  // 1. Anyone logged in (or explicitly Investors) can view the snapshot
  async getByProject(projectId: string) {
    const snapshot = await this.prisma.investorSnapshot.findUnique({
      where: { projectId },
    });

    if (!snapshot) {
      throw new NotFoundException('Investor snapshot for this project not found');
    }
    return snapshot;
  }

  // 2. Create snapshot (Only project owner)
  async create(projectId: string, userId: string, dto: any) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Guard: Prevent users from modifying projects they do not own
    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not own this project');
    }

    return this.prisma.investorSnapshot.create({
      data: {
        ...dto,
        projectId,
      },
    });
  }

  // 3. Update snapshot safely using Upsert
  async update(projectId: string, userId: string, dto: any) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Guard: Prevent users from modifying projects they do not own
    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not own this project');
    }

    // FIX: Use upsert so it creates the record if it doesn't exist yet
    return this.prisma.investorSnapshot.upsert({
      where: {
        projectId,
      },
      update: dto,
      create: {
        ...dto,
        projectId,
      },
    });
  }
}
