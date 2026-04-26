# Friendship System: Quick Start & Migration Guide

## 🚀 Quick Start

### Step 1: Apply Database Migration

```bash
# Run the migration to create the friendships table
npx prisma migrate deploy

# If you're in development, you can also use:
npx prisma db push
```

### Step 2: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 3: Restart Your Application

```bash
npm run dev
# or
npm start
```

### Step 4: Run Tests (Optional)

```bash
# Test all privacy visibility modes
npm run test -- tests/privacy/privacy-visibility.test.ts

# Test profile completion
npm run test -- tests/profile/profile-completion.test.ts
```

---

## 📋 Friendship System Overview

The friendship system enables the **FRIENDS_ONLY** privacy mode to work properly. Users can now:

- Send and receive friend requests
- Accept or decline requests
- Remove friends
- Block and unblock users
- View their friend list

---

## 🔧 API Endpoints Reference

### Get Friends
```bash
curl -X GET http://localhost:3000/api/friends \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "data": [
    {
      "id": "friendship-id",
      "friendData": {
        "id": "friend-user-id",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://..."
      },
      "status": "ACCEPTED",
      "acceptedAt": "2026-04-26T10:00:00Z"
    }
  ],
  "status": "success"
}
```

### Send Friend Request
```bash
curl -X POST http://localhost:3000/api/friends/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUserId": "user-id-to-befriend"
  }'
```

Response:
```json
{
  "data": {
    "id": "friendship-id",
    "userId": "your-user-id",
    "friendId": "target-user-id",
    "status": "PENDING",
    "requestedAt": "2026-04-26T10:00:00Z",
    "acceptedAt": null,
    "blockedAt": null
  },
  "status": "success",
  "message": "Friend request sent",
  "code": 201
}
```

### Get Pending Friend Requests (Incoming)
```bash
curl -X GET http://localhost:3000/api/friends/requests/pending \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Accept Friend Request
```bash
curl -X POST http://localhost:3000/api/friends/requests/accept \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "friendshipId": "friendship-id-to-accept"
  }'
```

### Decline Friend Request
```bash
curl -X POST http://localhost:3000/api/friends/requests/decline \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "friendshipId": "friendship-id-to-decline"
  }'
```

### Remove Friend
```bash
curl -X POST http://localhost:3000/api/friends/remove \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "friendId": "friend-user-id"
  }'
```

### Block User
```bash
curl -X POST http://localhost:3000/api/friends/block \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "blockedUserId": "user-id-to-block"
  }'
```

Note: Blocking a user also removes them from your friends list.

### Get Blocked Users
```bash
curl -X GET http://localhost:3000/api/friends/blocked \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔐 Privacy & Access Control

### FRIENDS_ONLY Profiles Now Work!

When a user sets their profile to **FRIENDS_ONLY**:
- ✅ Only their accepted friends can see the profile
- ✅ Friend requests are pending until accepted
- ✅ Blocked users cannot see the profile
- ✅ Anonymous users cannot see the profile

### Example: Accessing a FRIENDS_ONLY Profile

```typescript
// Friend tries to view profile
const canView = await PrivacyService.canViewProfile(friendUserId, profileOwnerId);
// Returns: { allowed: true } if they're friends
// Returns: { allowed: false, reason: 'friends_only' } if not friends

// Blocked user tries to view profile
const blockedView = await PrivacyService.canViewProfile(blockedUserId, profileOwnerId);
// Returns: { allowed: false, reason: 'blocked' }
```

---

## 📊 Database Schema

### Friendships Table

```sql
CREATE TABLE "friendships" (
    id UUID PRIMARY KEY,
    userId UUID NOT NULL REFERENCES users(id),
    friendId UUID NOT NULL REFERENCES users(id),
    status ENUM ('PENDING', 'ACCEPTED', 'BLOCKED'),
    requestedAt TIMESTAMP,
    acceptedAt TIMESTAMP,
    blockedAt TIMESTAMP,
    createdAt TIMESTAMP,
    updatedAt TIMESTAMP,
    
    UNIQUE(userId, friendId),
    INDEX(userId, status),
    INDEX(friendId, status),
    INDEX(status)
);
```

### Key Points:
- One-directional: (userId → friendId)
- Can check both directions for friendships: `(A→B) OR (B→A)`
- Separate statuses: PENDING, ACCEPTED, BLOCKED
- Timestamps track state transitions

---

## 🧪 Testing

### Run Friendship Tests
```bash
npm run test -- tests/privacy/privacy-visibility.test.ts -t "FRIENDS_ONLY"
```

### Manual Test Scenario

1. Create two users (Alice and Bob)
2. Alice sends friend request to Bob
3. Bob accepts the request
4. Alice sets profile to FRIENDS_ONLY
5. Bob can view Alice's profile ✓
6. Charlie (not friends) cannot view Alice's profile ✗

### Code Example:
```typescript
// Create friendship
const req = await FriendshipService.sendFriendRequest(aliceId, bobId);
await FriendshipService.acceptFriendRequest(bobId, req.id);

// Set Alice's profile to FRIENDS_ONLY
await PrivacyService.updateProfileVisibility(aliceId, 'FRIENDS_ONLY');

// Bob can view
const bobView = await PrivacyService.getFilteredProfileData(bobId, aliceId);
expect(bobView).toBeTruthy(); // ✓

// Charlie cannot view
const charlieView = await PrivacyService.getFilteredProfileData(charlieId, aliceId);
expect(charlieView).toBeNull(); // ✗
```

---

## ⚠️ Migration Notes

### Backward Compatibility
- ✅ All existing privacy settings still work
- ✅ Legacy `blockList` still functions
- ✅ New friendship system works alongside existing features
- ✅ No data loss or conflicts

### What Changed
- New `Friendship` table added (no existing data affected)
- New `FriendshipStatus` enum added
- User model extended with friendship relations (backcompat)
- Privacy visibility now checks both blocking mechanisms

### Reverting (If Needed)
```bash
# Roll back the migration
npx prisma migrate resolve --rolled-back 20260426_add_friendship_model

# Or use your database backup
```

---

## 🛠️ Troubleshooting

### Issue: Prisma Client out of sync
```bash
# Regenerate Prisma Client
npx prisma generate
```

### Issue: Migration fails
```bash
# Check migration status
npx prisma migrate status

# Reset database (development only!)
npx prisma migrate reset
```

### Issue: Friends can't see FRIENDS_ONLY profiles
1. Verify friendship is ACCEPTED (not PENDING)
2. Check user is not blocked
3. Verify profile visibility is set to FRIENDS_ONLY
4. Check privacy settings weren't overridden

```typescript
// Debug: Check friendship status
const friendship = await prisma.friendship.findFirst({
  where: {
    OR: [
      { userId: viewerId, friendId: targetId },
      { userId: targetId, friendId: viewerId }
    ]
  }
});
console.log(friendship?.status); // Should be ACCEPTED
```

### Issue: Performance concerns
- FRIENDS_ONLY checks use indexed fields (fast)
- Friendship queries should complete in <5ms
- Monitor query performance with logs if needed

---

## 📝 Example: Complete Friendship Flow

```typescript
import { FriendshipService } from 'src/services/FriendshipService';

// 1. Alice sends friend request to Bob
const friendshipRequest = await FriendshipService.sendFriendRequest(
  aliceId,
  bobId
);
console.log('Request ID:', friendshipRequest.id);
console.log('Status:', friendshipRequest.status); // PENDING

// 2. Bob gets pending requests
const pending = await FriendshipService.getPendingRequests(bobId);
console.log('Pending:', pending.length); // 1

// 3. Bob accepts the request
const accepted = await FriendshipService.acceptFriendRequest(
  bobId,
  friendshipRequest.id
);
console.log('Status:', accepted.status); // ACCEPTED

// 4. Alice gets her friends list
const friends = await FriendshipService.getFriends(aliceId);
console.log('Friends:', friends); // [bobId]

// 5. Alice sets profile to FRIENDS_ONLY
await PrivacyService.updateProfileVisibility(aliceId, 'FRIENDS_ONLY');

// 6. Bob can see Alice's profile
const profile = await PrivacyService.getFilteredProfileData(bobId, aliceId);
console.log('Bob sees Alice:', profile?.bio); // "Test bio"

// 7. Charlie cannot
const charlieProfile = await PrivacyService.getFilteredProfileData(charlieId, aliceId);
console.log('Charlie sees Alice:', charlieProfile); // null

// 8. Alice blocks Bob
await FriendshipService.blockUser(aliceId, bobId);

// 9. Bob can no longer see Alice
const blockedView = await PrivacyService.getFilteredProfileData(bobId, aliceId);
console.log('Bob blocked:', blockedView); // null

// 10. Alice removes the block
await FriendshipService.unblockUser(aliceId, bobId);
```

---

## 📚 Documentation

- **Full Implementation Details:** `FRIENDSHIP_IMPLEMENTATION.md`
- **Privacy System Assessment:** `TASK_ASSESSMENT.md`
- **API Reference:** `docs/USER_PROFILE_PREFERENCES_API.md`

---

## Happy Friending! 🎉

The friendship system is now live and ready to use. Users can manage their social connections and control profile visibility based on friendships.

For questions or issues, refer to `FRIENDSHIP_IMPLEMENTATION.md` or contact the development team.
