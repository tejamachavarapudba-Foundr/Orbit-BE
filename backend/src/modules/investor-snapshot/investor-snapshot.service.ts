import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvestorSnapshotService {
  constructor(private prisma: PrismaService) {}

  async getByProject(projectId: string) {
    return this.prisma.investorSnapshot.findUnique({
      where: {
        projectId,
      },
    });
  }

  async create(projectId: string, userId: string, dto: any) {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.investorSnapshot.create({
      data: {
        ...dto,
        projectId,
      },
    });
  }

  async update(projectId: string, userId: string, dto: any) {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      throw new NotFoundException();
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.investorSnapshot.update({
      where: {
        projectId,
      },
      data: dto,
    });
  }
}