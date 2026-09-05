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

    // 1. Check if they are already mutually connected. A Connection row only
    // in one direction means one side follows the other without having
    // connected — that shouldn't block a real connection request.
    const [forwardEdge, reverseEdge] = await Promise.all([
      this.prisma.connection.findUnique({
        where: { followerId_followingId: { followerId: requesterId, followingId: recipientId } },
      }),
      this.prisma.connection.findUnique({
        where: { followerId_followingId: { followerId: recipientId, followingId: requesterId } },
      }),
    ]);

    if (forwardEdge && reverseEdge) {
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
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    return this.prisma.connectionRequest.findMany({
      where: {
        recipientId: profileId,
        status: 'pending',
        // An ignored request expires after 30 days too, same as a
        // declined one does for the sender — it shouldn't keep demanding
        // a response indefinitely.
        updatedAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) },
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
      take: 300,
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
      take: 300,
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
      // 🟢 NEW: Automatically instantiate a Chat Room and pre-populate it with the connection note!
      this.prisma.conversation.create({
        data: {
        userAId: request.requesterId,
        userBId: request.recipientId,
        lastMessageAt: new Date(),
        messages: request.note ? {
           create: {
             senderId: request.requesterId,
             content: request.note, // Inserts their note right into the chat thread!
            }
          } : undefined
        }
      })
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

    // 1. Check if they are mutually connected — a Connection row exists in
    // both directions. A row in only one direction is a one-way follow, not
    // a connection.
    const [forwardEdge, reverseEdge] = await Promise.all([
      this.prisma.connection.findUnique({
        where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } },
      }),
      this.prisma.connection.findUnique({
        where: { followerId_followingId: { followerId: targetUserId, followingId: currentUserId } },
      }),
    ]);

    if (forwardEdge && reverseEdge) {
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

    if (pendingRequest) {
      const isSender = pendingRequest.requesterId === currentUserId;
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      // updatedAt, not createdAt: a re-sent request reuses the same row
      // (see createRequest's flip-to-pending path) and updatedAt is what
      // reflects when the current pending window actually started.
      const withinWindow = Date.now() - pendingRequest.updatedAt.getTime() <= THIRTY_DAYS_MS;

      if (pendingRequest.status === 'pending' && withinWindow) {
        return {
          status: isSender ? 'outgoing_pending' : 'incoming_pending',
          requestId: pendingRequest.id,
        };
      }

      // A decline is only masked as "still pending" for the sender — they
      // can't immediately re-request or tell they were declined, matching
      // the existing note on declineRequest. The recipient who declined it
      // already sees it drop out of their own incoming list (getIncoming
      // filters to status 'pending'), so it's fine to fall through to
      // 'none' for them here.
      if (pendingRequest.status === 'declined' && isSender && withinWindow) {
        return { status: 'outgoing_pending', requestId: pendingRequest.id };
      }
    }

    // Expired (30+ days), cancelled, accepted-elsewhere, or no history —
    // display the Connect option again.
    return { status: 'none' };
  }

  // Batched version of getConnectionStatus + getConnectionCount for a list
  // of target users. The first cut of this just ran the single-target
  // methods in Promise.all per id — one request instead of 2*N, but still
  // up to 5*N individual DB queries underneath (each status check alone is
  // 3 queries, each count is 2 more). Rewritten here to do the same work
  // with a fixed ~5 queries total regardless of N, using set membership in
  // JS instead of a query per target — the kind of N+1 that's easy to miss
  // because Promise.all already hides the latency, but still stacks up
  // real load on the DB's connection pool (Railway's Postgres has hit
  // connection-pressure issues before).
  async getBulkConnectionInfo(currentUserId: string, targetIds: string[]) {
    const uniqueIds = Array.from(new Set(targetIds.filter((id) => id && id !== currentUserId)));
    if (uniqueIds.length === 0) return {};

    const [forwardEdges, reverseEdges, requests, targetOutgoing] = await Promise.all([
      // currentUser -> target
      this.prisma.connection.findMany({
        where: { followerId: currentUserId, followingId: { in: uniqueIds } },
        select: { followingId: true },
      }),
      // target -> currentUser
      this.prisma.connection.findMany({
        where: { followerId: { in: uniqueIds }, followingId: currentUserId },
        select: { followerId: true },
      }),
      this.prisma.connectionRequest.findMany({
        where: {
          OR: [
            { requesterId: currentUserId, recipientId: { in: uniqueIds } },
            { requesterId: { in: uniqueIds }, recipientId: currentUserId },
          ],
        },
      }),
      // Every target's own outgoing edges, to compute each one's mutual-
      // connection count (independent of currentUserId).
      this.prisma.connection.findMany({
        where: { followerId: { in: uniqueIds } },
        select: { followerId: true, followingId: true },
      }),
    ]);

    const followsCurrentUser = new Set(forwardEdges.map((edge) => edge.followingId));
    const currentUserFollows = new Set(reverseEdges.map((edge) => edge.followerId));

    // One more pass to check, for every (target -> followedPerson) edge,
    // whether followedPerson follows that target back — the same mutuality
    // rule getConnectedProfiles applies for a single user, batched here.
    const followedIds = Array.from(new Set(targetOutgoing.map((edge) => edge.followingId)));
    const reverseOfOutgoing = followedIds.length
      ? await this.prisma.connection.findMany({
          where: { followerId: { in: followedIds }, followingId: { in: uniqueIds } },
          select: { followerId: true, followingId: true },
        })
      : [];
    const mutualPairs = new Set(reverseOfOutgoing.map((edge) => `${edge.followingId}:${edge.followerId}`));
    const countByTarget = new Map<string, number>();
    for (const edge of targetOutgoing) {
      // Same defensive check as getConnectedProfiles — a self-connection
      // row shouldn't exist, but don't count it if bad data slipped through.
      if (edge.followerId !== edge.followingId && mutualPairs.has(`${edge.followerId}:${edge.followingId}`)) {
        countByTarget.set(edge.followerId, (countByTarget.get(edge.followerId) ?? 0) + 1);
      }
    }

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const requestByTarget = new Map<string, (typeof requests)[number]>();
    for (const request of requests) {
      const targetId = request.requesterId === currentUserId ? request.recipientId : request.requesterId;
      const existing = requestByTarget.get(targetId);
      if (!existing || request.updatedAt > existing.updatedAt) {
        requestByTarget.set(targetId, request);
      }
    }

    const result: Record<string, { status: string; requestId?: string; count: number }> = {};

    for (const targetId of uniqueIds) {
      const count = countByTarget.get(targetId) ?? 0;

      if (followsCurrentUser.has(targetId) && currentUserFollows.has(targetId)) {
        result[targetId] = { status: 'connected', count };
        continue;
      }

      const request = requestByTarget.get(targetId);
      if (request) {
        const isSender = request.requesterId === currentUserId;
        const withinWindow = now - request.updatedAt.getTime() <= THIRTY_DAYS_MS;

        if (request.status === 'pending' && withinWindow) {
          result[targetId] = { status: isSender ? 'outgoing_pending' : 'incoming_pending', requestId: request.id, count };
          continue;
        }
        if (request.status === 'declined' && isSender && withinWindow) {
          result[targetId] = { status: 'outgoing_pending', requestId: request.id, count };
          continue;
        }
      }

      result[targetId] = { status: 'none', count };
    }

    return result;
  }

  async getConnectionCount(userId: string) {
    const profiles = await this.getConnectedProfiles(userId);
    return { count: profiles.length };
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
    take: 1000,
  });

  // A Connection row only exists in one direction for a one-way follow —
  // only rows with a matching reverse edge are real, mutual connections.
  const reverseEdges = connections.length
    ? await this.prisma.connection.findMany({
        where: {
          followerId: { in: connections.map((conn) => conn.following.id) },
          followingId: userId,
        },
        select: { followerId: true },
      })
    : [];
  const mutualIds = new Set(reverseEdges.map((edge) => edge.followerId));

  // Safety filter to ensure no self-connections slip through from old test logs
  return connections
    .filter((conn) => conn.following.id !== userId && mutualIds.has(conn.following.id))
    .map((conn) => ({
      connectionId: conn.id,
      connectedAt: conn.createdAt,
      profile: conn.following, // Clean nested profile object
    }));
}


}
