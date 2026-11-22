# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Any collection not explicitly matched is denied for both read and write (`allow read, write: if false;`).
2. **Silent Multi-User Authentication (Anonymous Auth) & Admin PII Protection**:
   - All operational writes (`dorms`, `students`, `notices`, `attendance`, `system_settings/config`, `_system_status/saved`, `profile_avatars`, `user_directory`, `user_auth`) require `request.auth != null` (`isSignedIn()`), satisfied automatically in the background via Firebase Anonymous Auth (`signInAnonymously`) or Google Sign-In without blocking multi-device teachers/staff with Google confirmation popups.
   - Sensitive PII collections (`/users/{userId}` containing `phone`/`passwordHash`, and `/admins/{adminId}`) remain strictly restricted to `isOwner(userId)` or `isAdmin()` (requiring `request.auth.token.email_verified == true` and bootstrapped admin email `domitory@pcccr.ac.th` or admin record).
   - Non-PII operational collections (`/dorms`, `/students`, `/notices`, `/attendance`, `/user_directory`, `/profile_avatars`), `/system_settings/config`, and `/_system_status/saved` allow read access for dashboard/login preflight, while `/user_auth/{userId}` allows single-document `get` by `userId` only (`allow list: if false;`) to verify PBKDF2-SHA256 credentials across devices.
3. **Referential Integrity**: Every `/students/{studentId}` and `/attendance/{attendanceId}` document created or updated must reference an existing `/dorms/{dormId}` document (`exists(...)`).
4. **Immutability**:
   - On `/attendance/{attendanceId}` updates: `id`, `date`, and `dormId` must remain immutable.
   - On `/users/{userId}`, `/user_directory/{userId}`, `/user_auth/{userId}`, `/dorms/{dormId}`, `/students/{studentId}`, `/notices/{noticeId}`, `/profile_avatars/{avatarId}` updates: `id` must remain immutable.
   - On `/users/{userId}` non-admin owner updates: `id`, `role`, `roleLevel`, `roleCategory` cannot be escalated.
5. **No Plaintext Credentials & PII Isolation**: `/users/{userId}`, `/user_directory/{userId}`, and `/user_auth/{userId}` must never contain a `password` key. `/users/{userId}` `get`/`list` are strictly restricted to `isOwner(userId) || isAdmin()`. `/user_directory/{userId}` omits PII (`phone`, `email`) and `passwordHash`. `/user_auth/{userId}` forbids `list`, omits PII, and enforces `^pbkdf2_sha256\$.+$` on `passwordHash`.
6. **Strict Field Allowlists & Bounds**: Every entity validation helper uses `keys().hasOnly([...])`, required-key checks `keys().hasAll([...])`, ID regex `^[a-zA-Z0-9_\\-]+$`, date regex `^\\d{4}-\\d{2}-\\d{2}$`, and explicit `.size()` bounds on all strings and arrays.

## 2. "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated write to `/dorms/dorm-1` or `/attendance/2026-11-20_dorm-1` (`request.auth == null`).
2. Unauthenticated or anonymous read of `/users/user-admin` PII (`request.auth == null` or `email_verified != true`).
3. Unverified email spoofing admin on `/users` (`email: "domitory@pcccr.ac.th", email_verified: false`).
4. Shadow field injection on `/attendance/2026-11-20_dorm-1` adding `"isApproved": true`.
5. Plaintext credential injection on `/users/user-1`, `/user_directory/user-1`, or `/user_auth/user-1` containing `"password": "secret123"`.
6. PII leakage attempt on `/user_directory/user-1` containing `"phone": "0812345678"` or `"passwordHash"`.
7. Listing `/user_auth` (`allow list: if false`) to enumerate password hashes.
8. Orphaned attendance or student record created with non-existent `dormId: "dorm-999"`.
9. Oversized ID poisoning (`1500` chars or invalid `/` characters in document ID).
10. Unbounded array injection (`records` with > 500 items or `topics` with > 30 items).
11. Mutating immutable `date` or `dormId` on an existing `/attendance/{attendanceId}` document.
12. Privilege escalation by non-admin owner updating `/users/{uid}` with `"roleLevel": 1`.
