import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConnectionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createRequest(
    requesterId: string,
    recipientId: string,
    note: string,
  ) {
    if (requesterId === recipientId) {
      throw new BadRequestException(
        'Cannot connect with yourself',
      );
    }

    // 1. Check if they are already connected
    const existingConnection = await this.prisma.connection.findUnique({
      where: {
        followerId_followingId: {
          followerId: requesterId,
          followingId: recipientId,
        },
      },
    });

    if (existingConnection) {
      throw new BadRequestException('You are already connected with this user');
    }

    // 2. Check for ANY existing request between these two users in either direction
    const existingRequest = await this.prisma.connectionRequest.findFirst({
      where: {
        OR: [
          { requesterId, recipientId },
          { requesterId: recipientId, recipientId: requesterId },
        ],
      },
    });

    if (existingRequest) {
      // If there is an active pending request, don't allow a new one
      if (existingRequest.status === 'pending') {
        throw new BadRequestException('A pending connection request already exists');
      }

      // LinkedIn Workflow: If a request was previously declined, cancelled, or accepted, 
      // we update and "flip" the existing record to reset it to pending.
      return this.prisma.connectionRequest.update({
        where: { id: existingRequest.id },
        data: {
          requesterId,  // Set the new requester
          recipientId,  // Set the new recipient
          note,
          status: 'pending',
        },
      });
    }

    // 3. If no historical record exists at all, create a fresh one
    return this.prisma.connectionRequest.create({
      data: {
        requesterId,
        recipientId,
        note,
        status: 'pending',
      },
    });
  }

  async getIncoming(profileId: string) {
    return this.prisma.connectionRequest.findMany({
      where: {
        recipientId: profileId,
        status: 'pending',
      },
      select: {
        id: true,
        status: true,
        note: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            headline: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getOutgoing(profileId: string) {
    return this.prisma.connectionRequest.findMany({
      where: {
        requesterId: profileId,
        status: 'pending', // LinkedIn usually only shows active pending outgoing requests
      },
      include: {
        recipient: {
          select: {
            id: true,
            fullName: true,
            headline: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async acceptRequest(
    requestId: string,
    recipientId: string,
  ) {
    const request =
      await this.prisma.connectionRequest.findUnique({
        where: {
          id: requestId,
        },
      });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.recipientId !== recipientId) {
      throw new ForbiddenException('You cannot accept this request');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('This request is no longer pending');
    }

    // Fix: Use upsert inside a transaction to prevent unique constraint failures
    await this.prisma.$transaction([
      this.prisma.connectionRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: 'accepted',
        },
      }),

      // Safely ensure Side A -> Side B relationship exists
      this.prisma.connection.upsert({
        where: {
          followerId_followingId: {
            followerId: request.requesterId,
            followingId: request.recipientId,
          },
        },
        update: {}, // Do nothing if it already exists
        create: {
          followerId: request.requesterId,
          followingId: request.recipientId,
        },
      }),

      // Safely ensure Side B -> Side A relationship exists
      this.prisma.connection.upsert({
        where: {
          followerId_followingId: {
            followerId: request.recipientId,
            followingId: request.requesterId,
          },
        },
        update: {}, // Do nothing if it already exists
        create: {
          followerId: request.recipientId,
          followingId: request.requesterId,
        },
      }),
    ]);

    return {
      success: true,
      status: 'accepted',
    };
  }

  async declineRequest(
    requestId: string,
    recipientId: string,
  ) {
    const request =
      await this.prisma.connectionRequest.findUnique({
        where: {
          id: requestId,
        },
      });

    if (!request) {
      throw new NotFoundException();
    }

    if (request.recipientId !== recipientId) {
      throw new ForbiddenException();
    }

    await this.prisma.connectionRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: 'declined', // Keeps history so the sender cannot immediately re-spam them
      },
    });

    return {
      success: true,
      status: 'declined',
    };
  }

  async deleteRequest(
    requestId: string,
    userId: string,
  ) {
    const request =
      await this.prisma.connectionRequest.findUnique({
        where: {
          id: requestId,
        },
      });

    if (!request) {
      throw new NotFoundException();
    }

    if (
      request.requesterId !== userId &&
      request.recipientId !== userId
    ) {
      throw new ForbiddenException();
    }

    await this.prisma.connectionRequest.delete({
      where: {
        id: requestId,
      },
    });

    return {
      success: true,
    };
  }

  // Append these 3 methods inside your ConnectionRequestsService class

  async getConnectionStatus(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      return { status: 'self' };
    }

    // 1. Check if they are officially connected
    const isConnected = await this.prisma.connection.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (isConnected) {
      return { status: 'connected' };
    }

    // 2. Check for an active pending invitation
    const pendingRequest = await this.prisma.connectionRequest.findFirst({
      where: {
        OR: [
          { requesterId: currentUserId, recipientId: targetUserId },
          { requesterId: targetUserId, recipientId: currentUserId },
        ],
      },
    });

    if (pendingRequest && pendingRequest.status === 'pending') {
      return {
        status: pendingRequest.requesterId === currentUserId ? 'outgoing_pending' : 'incoming_pending',
        requestId: pendingRequest.id,
      };
    }

    // If declined, cancelled, or no history exists, display Connect option
    return { status: 'none' };
  }

  async getConnectionCount(userId: string) {
    const count = await this.prisma.connection.count({
      where: {
        followerId: userId,
      },
    });

    return { count };
  }

  async getConnectedProfiles(userId: string) {
  const connections = await this.prisma.connection.findMany({
    where: {
      followerId: userId,
    },
    select: {
      id: true,         // The unique ID of the connection row itself
      createdAt: true,  // When they became connections
      following: {
        select: {
          id: true,
          fullName: true,
          headline: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Shows newest connections first like LinkedIn
    },
  });

  // Safety filter to ensure no self-connections slip through from old test logs
  return connections
    .filter((conn) => conn.following.id !== userId)
    .map((conn) => ({
      connectionId: conn.id,
      connectedAt: conn.createdAt,
      profile: conn.following, // Clean nested profile object
    }));
}


}
