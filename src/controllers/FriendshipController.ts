import { Request, Response } from "express";
import BaseController from "./BaseController";
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { FriendshipService } from 'src/services/FriendshipService';
import { prisma } from 'src/db';

/**
 * FriendshipController - Manages friend relationships and friend requests
 */
export default class FriendshipController extends BaseController {
    /**
     * Get all accepted friends for the current user
     */
    getFriends = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            const friends = await FriendshipService.getFriendsWithDetails(userId);

            res.json({
                data: friends,
                status: 'success',
                message: 'Friends list retrieved',
                code: 200,
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Send a friend request to another user
     */
    sendFriendRequest = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { targetUserId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(targetUserId, 'Target user ID required', 400);
            RequestError.abortIf(userId === targetUserId, 'Cannot send friend request to yourself', 400);

            // Verify target user exists
            const targetUser = await prisma.user.findUnique({
                where: { id: targetUserId },
            });
            RequestError.assertFound(targetUser, 'User not found', 404);

            // Send friend request
            const friendship = await FriendshipService.sendFriendRequest(userId, targetUserId);

            // Log the action
            await logAuditEvent(userId, 'PROFILE_UPDATE', {
                req,
                entityType: 'Friendship',
                entityId: friendship.id,
                metadata: { action: 'send_friend_request', targetUserId },
            });

            res.json({
                data: friendship,
                status: 'success',
                message: 'Friend request sent',
                code: 201,
            });
        } catch (error) {
            if (error instanceof Error) {
                RequestError.abortIf(true, error.message, 400);
            }
            throw error;
        }
    };

    /**
     * Get pending friend requests for the current user
     */
    getPendingRequests = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            const requests = await FriendshipService.getPendingRequests(userId);

            res.json({
                data: requests,
                status: 'success',
                message: 'Pending friend requests retrieved',
                code: 200,
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get sent friend requests from the current user
     */
    getSentRequests = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            const requests = await FriendshipService.getSentRequests(userId);

            res.json({
                data: requests,
                status: 'success',
                message: 'Sent friend requests retrieved',
                code: 200,
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Accept a friend request
     */
    acceptFriendRequest = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { friendshipId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(friendshipId, 'Friendship ID required', 400);

            const friendship = await FriendshipService.acceptFriendRequest(userId, friendshipId);

            // Log the action
            await logAuditEvent(userId, 'PROFILE_UPDATE', {
                req,
                entityType: 'Friendship',
                entityId: friendship.id,
                metadata: { action: 'accept_friend_request' },
            });

            res.json({
                data: friendship,
                status: 'success',
                message: 'Friend request accepted',
                code: 200,
            });
        } catch (error) {
            if (error instanceof Error) {
                RequestError.abortIf(true, error.message, 400);
            }
            throw error;
        }
    };

    /**
     * Decline a friend request
     */
    declineFriendRequest = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { friendshipId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(friendshipId, 'Friendship ID required', 400);

            await FriendshipService.declineFriendRequest(userId, friendshipId);

            // Log the action
            await logAuditEvent(userId, 'PROFILE_UPDATE', {
                req,
                entityType: 'Friendship',
                entityId: friendshipId,
                metadata: { action: 'decline_friend_request' },
            });

            res.json({
                status: 'success',
                message: 'Friend request declined',
                code: 200,
            });
        } catch (error) {
            if (error instanceof Error) {
                RequestError.abortIf(true, error.message, 400);
            }
            throw error;
        }
    };

    /**
     * Remove a friend
     */
    removeFriend = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { friendId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(friendId, 'Friend ID required', 400);

            await FriendshipService.removeFriend(userId, friendId);

            // Log the action
            await logAuditEvent(userId, 'PROFILE_UPDATE', {
                req,
                entityType: 'Friendship',
                metadata: { action: 'remove_friend', friendId },
            });

            res.json({
                status: 'success',
                message: 'Friend removed',
                code: 200,
            });
        } catch (error) {
            if (error instanceof Error) {
                RequestError.abortIf(true, error.message, 400);
            }
            throw error;
        }
    };

    /**
     * Block a user
     */
    blockUser = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { blockedUserId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(blockedUserId, 'Blocked user ID required', 400);

            const blockedUser = await prisma.user.findUnique({
                where: { id: blockedUserId },
            });
            RequestError.assertFound(blockedUser, 'User not found', 404);

            const block = await FriendshipService.blockUser(userId, blockedUserId);

            // Log the action
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'Friendship',
                entityId: block.id,
                metadata: { action: 'block_user', blockedUserId },
            });

            res.json({
                data: block,
                status: 'success',
                message: 'User blocked',
                code: 200,
            });
        } catch (error) {
            if (error instanceof Error) {
                RequestError.abortIf(true, error.message, 400);
            }
            throw error;
        }
    };

    /**
     * Unblock a user
     */
    unblockUser = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { unblockedUserId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(unblockedUserId, 'Unblocked user ID required', 400);

            await FriendshipService.unblockUser(userId, unblockedUserId);

            // Log the action
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'Friendship',
                metadata: { action: 'unblock_user', unblockedUserId },
            });

            res.json({
                status: 'success',
                message: 'User unblocked',
                code: 200,
            });
        } catch (error) {
            if (error instanceof Error) {
                RequestError.abortIf(true, error.message, 400);
            }
            throw error;
        }
    };

    /**
     * Get blocked users
     */
    getBlockedUsers = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            const blockedUsers = await FriendshipService.getBlockedUsers(userId);

            res.json({
                data: blockedUsers,
                status: 'success',
                message: 'Blocked users retrieved',
                code: 200,
            });
        } catch (error) {
            throw error;
        }
    };
}
