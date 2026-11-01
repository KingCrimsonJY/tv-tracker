# Security Specification — Personal Watch Tracker

## 1. Data Invariants
1. **Strict Single-Owner Isolation**: Every document lives under `/users/{userId}/**`. Only an authenticated user with `request.auth.uid == userId` and `request.auth.token.email_verified == true` may read, list, create, update, or delete any document under `/users/{userId}/**`.
2. **ID & Payload Bounds**: Document IDs (`userId`, `titleId`, `seasonNumber`, `playthroughId`, `listId`, `entryId`, `settingId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars.
3. **Schema Validation**: All writes validate required keys, allowed keys, and field types/sizes via dedicated `isValidTitle`, `isValidSeason`, `isValidProgress`, `isValidWatchList`, `isValidListEntry`, and `isValidAppSettings` helpers.

## 2. The "Dirty Dozen" Payloads
1. Unauthenticated read on `/users/u1/titles/t1` -> `PERMISSION_DENIED`
2. Cross-user read (`uid: u2`) on `/users/u1/titles/t1` -> `PERMISSION_DENIED`
3. Unverified email write (`email_verified: false`) on `/users/u1/titles/t1` -> `PERMISSION_DENIED`
4. Shadow field injection (`isAdmin: true`) on `/users/u1/titles/t1` -> `PERMISSION_DENIED`
5. Oversized title name (> 500 chars) on `/users/u1/lists/l1` -> `PERMISSION_DENIED`
6. Invalid `mediaType` (`"podcast"`) on `/users/u1/titles/t1` -> `PERMISSION_DENIED`
7. Invalid `kind` (`"grid"`) on `/users/u1/lists/l1` -> `PERMISSION_DENIED`
8. Missing required field (`activePlaythroughId`) on `/users/u1/titles/t1` -> `PERMISSION_DENIED`
9. Oversized ID poisoning (> 128 chars) on `/users/u1/titles/{longId}` -> `PERMISSION_DENIED`
10. Cross-user delete (`uid: u2`) on `/users/u1/lists/l1/entries/e1` -> `PERMISSION_DENIED`
11. Unbounded genres array (> 30 items) on `/users/u1/titles/t1` -> `PERMISSION_DENIED`
12. Root path arbitrary document write `/otherCollection/doc1` -> `PERMISSION_DENIED`
