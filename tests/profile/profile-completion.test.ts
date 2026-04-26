import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import ProfileController from '../../../src/controllers/ProfileController';

const prisma = new PrismaClient();

describe('Profile Completion', () => {
  let profileController: ProfileController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    profileController = new ProfileController();
    mockReq = {
      user: { id: 'test-user-id' },
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(async () => {
    await prisma.userProfile.deleteMany({
      where: { userId: 'test-user-id' },
    });
  });

  describe('updateProfile', () => {
    it('should calculate completion percentage correctly from merged state', async () => {
      // Create initial profile with some fields
      const initialProfile = await prisma.userProfile.create({
        data: {
          userId: 'test-user-id',
          bio: 'Test bio',
          profilePictureUrl: 'https://example.com/avatar.jpg',
          profileCompletionPercentage: 33, // 2/6 fields filled
        },
      });

      // Update with one more field
      mockReq.body = {
        website: 'https://example.com',
      };

      await profileController.updateProfile(mockReq as Request, mockRes as Response);

      // Should now have 3/6 fields filled = 50%
      const updatedProfile = await prisma.userProfile.findUnique({
        where: { userId: 'test-user-id' },
      });

      expect(updatedProfile?.profileCompletionPercentage).toBe(50);
      expect(updatedProfile?.bio).toBe('Test bio'); // Original field preserved
      expect(updatedProfile?.website).toBe('https://example.com'); // New field added
    });

    it('should not decrease completion percentage with partial updates', async () => {
      // Create complete profile
      await prisma.userProfile.create({
        data: {
          userId: 'test-user-id',
          bio: 'Test bio',
          dateOfBirth: new Date('1990-01-01'),
          profilePictureUrl: 'https://example.com/avatar.jpg',
          website: 'https://example.com',
          occupation: 'Developer',
          companyName: 'Tech Corp',
          profileCompletionPercentage: 100,
        },
      });

      // Update with empty field (should not affect completion)
      mockReq.body = {
        bio: 'Updated bio', // Still non-empty
      };

      await profileController.updateProfile(mockReq as Request, mockRes as Response);

      const updatedProfile = await prisma.userProfile.findUnique({
        where: { userId: 'test-user-id' },
      });

      expect(updatedProfile?.profileCompletionPercentage).toBe(100);
      expect(updatedProfile?.bio).toBe('Updated bio');
    });

    it('should handle creation of new profile with completion calculation', async () => {
      mockReq.body = {
        bio: 'Test bio',
        website: 'https://example.com',
      };

      await profileController.updateProfile(mockReq as Request, mockRes as Response);

      const profile = await prisma.userProfile.findUnique({
        where: { userId: 'test-user-id' },
      });

      expect(profile?.profileCompletionPercentage).toBe(33); // 2/6 fields
      expect(profile?.bio).toBe('Test bio');
      expect(profile?.website).toBe('https://example.com');
    });

    it('should update completion percentage when fields are cleared', async () => {
      // Create profile with some fields
      await prisma.userProfile.create({
        data: {
          userId: 'test-user-id',
          bio: 'Test bio',
          website: 'https://example.com',
          occupation: 'Developer',
          profileCompletionPercentage: 50, // 3/6 fields
        },
      });

      // Clear one field
      mockReq.body = {
        bio: '', // Clear this field
      };

      await profileController.updateProfile(mockReq as Request, mockRes as Response);

      const updatedProfile = await prisma.userProfile.findUnique({
        where: { userId: 'test-user-id' },
      });

      expect(updatedProfile?.profileCompletionPercentage).toBe(33); // 2/6 fields
      expect(updatedProfile?.bio).toBe('');
    });
  });

  describe('getProfileCompletion', () => {
    it('should return profile completion status', async () => {
      await prisma.userProfile.create({
        data: {
          userId: 'test-user-id',
          bio: 'Test bio',
          profilePictureUrl: 'https://example.com/avatar.jpg',
          profileCompletionPercentage: 33,
        },
      });

      await profileController.getProfileCompletion(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileCompletionPercentage: 33,
            bio: 'Test bio',
            profilePictureUrl: 'https://example.com/avatar.jpg',
          }),
        })
      );
    });

    it('should return 0% for non-existent profile', async () => {
      await profileController.getProfileCompletion(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileCompletionPercentage: 0,
          }),
        })
      );
    });
  });
});
