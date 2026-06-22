import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path if needed
import { CreateMeetingRequestDto } from './dto/createmeetingRequests.dto';

@Injectable()
export class MeetingRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(investorId: string, dto: CreateMeetingRequestDto) {
    const targetDate1 = new Date(dto.preferredDate1);
    const targetDate2 = new Date(dto.preferredDate2);

    const existingDuplicate = await this.prisma.meetingRequest.findFirst({
      where: {
        investorId,
        startupId: dto.startupId,
        purpose: dto.purpose,
        preferredDate1: targetDate1,
        preferredTime1: dto.preferredTime1,
        preferredDate2: targetDate2,
        preferredTime2: dto.preferredTime2,
        message: dto.message,
      },
    });

    if (existingDuplicate) {
      throw new ConflictException('An identical meeting request already exists.');
    }

    return this.prisma.meetingRequest.create({
      data: {
        ...dto,
        preferredDate1: targetDate1,
        preferredDate2: targetDate2,
        investorId,
      },
    });
  }

  async getInvestorRequests(investorId: string) {
    return this.prisma.meetingRequest.findMany({
      where: { investorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFounderRequests(startupId: string) {
    return this.prisma.meetingRequest.findMany({
      where: { startupId },
      include: {
        investor: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdminRequests() {
    return this.prisma.meetingRequest.findMany({
      include: {
        investor: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRequestStatus(id: string, status: 'pending' | 'founder_contacted' | 'approved' | 'rejected') {
    try {
      return await this.prisma.meetingRequest.update({
        where: { id },
        data: { status },
      });
    } catch {
      throw new NotFoundException(`Meeting request with ID "${id}" not found.`);
    }
  }
}
