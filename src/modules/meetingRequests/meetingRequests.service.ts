import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; 
import { CreateMeetingRequestDto } from './dto/createmeetingRequests.dto';

@Injectable()
export class MeetingRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(investorId: string, dto: CreateMeetingRequestDto) {
    if (!investorId) {
      throw new BadRequestException('Investor ID cannot be processed or found.');
    }

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

    // Separate startupId from DTO body so we do not pass a scalar and relation link simultaneously
    const { startupId, ...remainingDto } = dto;

    return this.prisma.meetingRequest.create({
      data: {
        ...remainingDto,
        preferredDate1: targetDate1,
        preferredDate2: targetDate2,
        // Map elements explicitly via structural relationships
        investor: { connect: { id: investorId } },
        startup: { connect: { id: startupId } },
      },
    });
  }

  async getInvestorRequests(investorId: string) {
    return this.prisma.meetingRequest.findMany({
      where: { investorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // FOUNDER DASHBOARD: Only sees requests that are NOT pending
  async getFounderRequests(startupId: string) {
    return this.prisma.meetingRequest.findMany({
      where: { 
        startupId,
        NOT: {
          status: 'pending' // Hides requests until admin changes this status
        }
      },
      include: {
        investor: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ADMIN DASHBOARD: Sees all requests, including pending ones
  async getAdminRequests() {
    const meetings = await this.prisma.meetingRequest.findMany({
      include: {
        investor: { select: { id: true, email: true } },
        // Added startup selection so admin knows which startup it belongs to
        startup: { select: { id: true } } 
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log("TOTAL ADMIN MEETINGS:", meetings.length);

    return meetings;
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
