# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Any collection not explicitly matched is denied for both read and write (`allow read, write: if false;`).
2. **Write Authentication & Bootstrapped Admin**: All writes (`create`, `update`, `delete`) and sensitive PII reads (`/users/{userId}`, `/admins/{adminId}`) require `request.auth != null && request.auth.token.email_verified == true`. Non-PII display collections (`/dorms`, `/students`, `/notices`, `/attendance`, `/user_directory`), `/system_settings/config`, and `/_system_status/saved` allow public read access so visitors and login screens on other devices can check non-PII account lists and initial-password status without Google Sign-In. `/user_auth/{userId}` allows single-document `get` by `userId` only (`allow list: if false;`) to verify passwords across devices. Admin privilege (`isAdmin()`) requires verified email matching the bootstrapped admin (`domitory@pcccr.ac.th`) or an admin entry in `/admins/{uid}` or `/users/{uid}` with `roleLevel == 1`.
3. **Referential Integrity**: Every `/students/{studentId}` and `/attendance/{attendanceId}` document created must reference an existing `/dorms/{dormId}` document (`exists(...)`).
4. **Immutability**:
   - On `/attendance/{attendanceId}` updates: `id`, `date`, and `dormId` must remain immutable.
   - On `/users/{userId}` and `/user_directory/{userId}` owner updates: `id`, `role`, `roleLevel`, `roleCategory`, `dormId`, and `allowedDormIds` cannot be escalated.
5. **No Plaintext Credentials & PII Isolation**: `/users/{userId}`, `/user_directory/{userId}`, and `/user_auth/{userId}` must never contain a `password` key. `/users/{userId}` `get`/`list` are strictly restricted to the owner (`isOwner(userId)`) or `isAdmin()`, `/user_directory/{userId}` omits PII (`phone`, `email`) and `passwordHash`, and `/user_auth/{userId}` forbids `list` and omits PII.
6. **Strict Field Allowlists & Bounds**: Every entity validation helper uses `keys().hasOnly([...])`, required-key checks `keys().hasAll([...])`, ID regex `^[a-zA-Z0-9_\\-]+$`, date regex `^\\d{4}-\\d{2}-\\d{2}$`, and explicit `.size()` bounds on all strings and arrays.

## 2. "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated write to `/dorms/dorm-1` or unauthenticated read of `/users/user-admin` (`request.auth == null`).
2. Unverified email spoofing admin (`email: "domitory@pcccr.ac.th", email_verified: false`).
3. Shadow field injection on `/attendance/2026-11-20_dorm-1` adding `"isApproved": true`.
4. Plaintext credential injection on `/users/user-1` containing `"password": "secret123"`.
5. Privilege escalation by non-admin owner updating `/users/{uid}` with `"roleLevel": 1`.
6. Cross-dorm attendance write by Level 3 dorm teacher assigned to `dorm-1` writing to `dorm-2`.
7. Orphaned attendance record created with non-existent `dormId: "dorm-999"`.
8. Oversized ID poisoning (`1500` chars or invalid `/` characters in document ID).
9. Unbounded array injection (`records` with > 500 items or `topics` with > 30 items).
10. PII leak attempt: non-admin user calling `list` on `/users` or `get` on another user's `/users/{otherUid}`.
11. Mutating immutable `date` or `dormId` on an existing `/attendance/{attendanceId}` document.
12. Non-admin writing to `/system_settings/config` or deleting `/dorms/{dormId}`.
