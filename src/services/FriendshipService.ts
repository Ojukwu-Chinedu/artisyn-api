import { prisma } from '../db';
import { FriendshipStatus } from '@prisma/client';

/**
 * FriendshipService - Manages friend relationships and friend-based privacy
 * Uses the Friendship model with PENDING/ACCEPTED/BLOCKED statuses
 */
export class FriendshipService {
  /**
   * Check if two users are friends (have ACCEPTED relationship)
   * Friendship can be initiated by either user
   */
  static async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: userId1, friendId: userId2, status: 'ACCEPTED' },
          { userId: userId2, friendId: userId1, status: 'ACCEPTED' },
        ],
      },
    });
    return !!friendship;
  }

  /**
   * Get all accepted friends for a user (both directions)
   */
  static async getFriends(userId: string): Promise<string[]> {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userId },
          { friendId: userId },
        ],
      },
      select: {
        userId: true,
        friendId: true,
      },
    });

    // Return friend IDs from both directions
    const friendIds = friendships.map(f =>
      f.userId === userId ? f.friendId : f.userId
    );
    return friendIds;
  }

  /**
   * Get friend details for all accepted friends
   */
  static async getFriendsWithDetails(userId: string): Promise<any[]> {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userId },
          { friendId: userId },
        ],
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        friend: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return friendships.map(f => ({
      id: f.id,
      friendData: f.userId === userId ? f.friend : f.user,
      status: f.status,
      acceptedAt: f.acceptedAt,
    }));
  }

  /**
   * Send a friend request
   * If already blocked, throws error
   */
  static async sendFriendRequest(userId: string, targetUserId: string): Promise<any> {
    if (userId === targetUserId) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if already friends or have pending request
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'BLOCKED') {
        throw new Error('Cannot send friend request to blocked user');
      }
      throw new Error('Friendship request already exists');
    }

    // Create new friend request
    const friendship = await prisma.friendship.create({
      data: {
        userId,
        friendId: targetUserId,
        status: 'PENDING',
      },
    });

    return friendship;
  }

  /**
   * Accept a friend request
   */
  static async acceptFriendRequest(userId: string, friendshipId: string): Promise<any> {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new Error('Friendship request not found');
    }

    // Verify the user is the recipient
    if (friendship.friendId !== userId) {
      throw new Error('Cannot accept friend request not addressed to you');
    }

    if (friendship.status !== 'PENDING') {
      throw new Error('Friendship request is not in pending status');
    }

    return prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
  }

  /**
   * Decline a friend request
   */
  static async declineFriendRequest(userId: string, friendshipId: string): Promise<void> {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new Error('Friendship request not found');
    }

    // Verify the user is the recipient
    if (friendship.friendId !== userId) {
      throw new Error('Cannot decline friend request not addressed to you');
    }

    if (friendship.status !== 'PENDING') {
      throw new Error('Friendship request is not in pending status');
    }

    // Delete the pending request
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });
  }

  /**
   * Remove/unfriend a friend
   * Works both directions
   */
  static async removeFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) {
      throw new Error('Cannot remove yourself as a friend');
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (!friendship) {
      throw new Error('Friendship not found');
    }

    await prisma.friendship.delete({
      where: { id: friendship.id },
    });
  }

  /**
   * Get pending friend requests for a user (requests FROM others TO this user)
   */
  static async getPendingRequests(userId: string): Promise<any[]> {
    const requests = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return requests;
  }

  /**
   * Get sent friend requests (requests FROM this user TO others)
   */
  static async getSentRequests(userId: string): Promise<any[]> {
    const requests = await prisma.friendship.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      include: {
        friend: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return requests;
  }

  /**
   * Block a user (cannot be friends, blocks incoming requests)
   */
  static async blockUser(userId: string, blockedUserId: string): Promise<any> {
    if (userId === blockedUserId) {
      throw new Error('Cannot block yourself');
    }

    // Delete any existing friendship relationship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId: blockedUserId },
          { userId: blockedUserId, friendId: userId },
        ],
      },
    });

    // Create block relationship
    const block = await prisma.friendship.create({
      data: {
        userId,
        friendId: blockedUserId,
        status: 'BLOCKED',
        blockedAt: new Date(),
      },
    });

    return block;
  }

  /**
   * Unblock a user
   */
  static async unblockUser(userId: string, unblockedUserId: string): Promise<void> {
    const block = await prisma.friendship.findFirst({
      where: {
        userId,
        friendId: unblockedUserId,
        status: 'BLOCKED',
      },
    });

    if (!block) {
      throw new Error('Block not found');
    }

    await prisma.friendship.delete({
      where: { id: block.id },
    });
  }

  /**
   * Check if user is blocked by another user
   */
  static async isBlockedBy(userId: string, potentialBlockerId: string): Promise<boolean> {
    const block = await prisma.friendship.findFirst({
      where: {
        userId: potentialBlockerId,
        friendId: userId,
        status: 'BLOCKED',
      },
    });

    return !!block;
  }

  /**
   * Get blocked users for a given user
   */
  static async getBlockedUsers(userId: string): Promise<any[]> {
    const blocks = await prisma.friendship.findMany({
      where: {
        userId,
        status: 'BLOCKED',
      },
      include: {
        friend: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return blocks.map(b => b.friend);
  }
}
