import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvestorSnapshotService {
  constructor(private prisma: PrismaService) {}

  // 1. The project owner always sees their own full snapshot (needed to
  // prefill the edit screens). Anyone else only sees a published snapshot,
  // and only if they're an investor — and even then never the founder's
  // compliance/KYC documents or private data-room links, which the investor
  // view screen never renders and have no legitimate reason to leave the
  // owner's own upload flow.
  async getByProject(projectId: string, userId: string) {
    const [project, snapshot] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
      this.prisma.investorSnapshot.findUnique({ where: { projectId } }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!snapshot) {
      throw new NotFoundException('Investor snapshot for this project not found');
    }

    if (project.ownerId === userId) {
      return snapshot;
    }

    const viewer = await this.prisma.profile.findUnique({ where: { id: userId }, select: { role: true } });
    if (viewer?.role !== 'investor' || !snapshot.isCompleted) {
      throw new ForbiddenException('You do not have access to this investor snapshot');
    }

    const {
      govtIdDocUrl,
      gstDocUrl,
      registrationDocUrl,
      dataRoomUrl,
      financialProjectionUrl,
      pitchDeckUrl,
      ...safeSnapshot
    } = snapshot;

    return safeSnapshot;
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
