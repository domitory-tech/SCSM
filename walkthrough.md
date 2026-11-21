# Security Summary

**Reviewed Files**: 64
**Issues Resolved**: 14

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Direct Unauthenticated Login Bypass | `src/components/auth/LoginModal.tsx`, `src/components/auth/UserSwitchModal.tsx` | — | A `"DIRECT"` login mode and passwordless switcher allowed signing into privileged admin/staff accounts without credential verification. | Critical | Fixed | Removed the `"DIRECT"` login tab and deleted `UserSwitchModal.tsx`. Enforced cryptographic verification (`PBKDF2-SHA256` / `scrypt`) and mandatory first-time password creation when unset (`!hasPassword`). |
| Hardcoded Default Passwords & Credential Exposure | `server.ts`, `src/data/userProfiles.ts`, `database.json`, `src/services/api.ts` | 185–325, 643 | Default passwords (`"123456"`, `"123"`, `"Tasawan*"`) and plaintext credentials were embedded in source files and returned by API/export payloads. | Critical | Fixed | Removed all hardcoded passwords and fallback defaults; added `scrypt` (`timingSafeEqual`) on server and `PBKDF2-SHA256` on client, scrubbed legacy plaintext secrets on disk load, and stripped credential fields via `sanitizeUserForClient` and `sanitizeServerUser`. |
| Exposed Static Database Backup & Leak References | `public/assets/aistudio/*`, `metadata.json`, `README.md`, `index.html`, `src/components/common/FirebaseStatusBadge.tsx` | — | A static database backup JSON was publicly served under `public/`, while UI/docs/comments exposed internal database brand names, project IDs, repository slugs, and an admin email. | High | Fixed | Deleted the static backup JSON and status telemetry badge; neutralized all user-facing and internal documentation/comment references to the primary cloud database without breaking live sync. |
| Missing Server-Side Auth, Sessions & RBAC | `server.ts` | 510–1413 | All write endpoints (`/api/dorms`, `/api/students`, `/api/users`, `/api/database/*`, `/api/attendance`, `/api/google-sheets/export`) and admin password overrides lacked authentication and role checks. | Critical | Fixed | Added HMAC-SHA256 Bearer token issuance/verification (`/api/auth/login`, `/api/auth/first-password`, `/api/auth/logout`, `/api/auth/me`) with server-side `requireAuth`, `requireRole`, and Level 3 dormitory ownership scoping. |
| Permissive Cloud Database Rules & Schema Drift | `firestore.rules`, `firebase-blueprint.json` | 1–9 | Cloud database rules permitted unrestricted `read, write: if true;` across all collections. | Critical | Fixed | Replaced wildcard access with default-deny rules (`allow read, write: if false;`), verified-email RBAC, PII isolation on `/users/{userId}`, strict field allowlists blocking plaintext `password` fields, and deployed rules. |
| Unsanitized HTML & Report Exporters (XSS) | `src/utils/htmlReportExporter.ts`, `src/utils/studentSearchReportExporter.ts`, `src/utils/dormRegisterBookExporter.ts`, `src/utils/lateReportPrintExporter.ts`, `src/utils/monthlyReportExporter.ts`, `src/utils/dormitoryReportExporter.ts`, `src/utils/dormLayoutPrintExporter.ts`, `src/utils/dashboardReportExporter.ts`, `src/components/reports/DailyReportView.tsx` | — | Student names, dormitory names, reasons, notices, and logo URLs were interpolated directly into HTML templates and `window.open` print popups. | High | Fixed | Applied `escapeHtml`, `escapeAttr`, `sanitizeSafeImageUrl`, `sanitizeHtmlFragment`, and `openSafeWindowUrl` (`noopener,noreferrer`) across all 8 exporters and report views. |
| Client Error Sink & Unsafe Image/URL Handling | `src/main.tsx`, `src/components/common/ErrorBoundary.tsx`, `src/utils/dateUtils.ts`, `src/utils/imageUtils.ts`, `src/services/googleDrive.ts` | — | Global error handlers wrote error strings into DOM markup, and image URL helpers allowed unvalidated schemes. | Medium | Fixed | Replaced DOM HTML writes with safe `textContent` node construction, restricted URL schemes via `sanitizeSafeImageUrl` / `sanitizeHttpsUrl` (blocking `javascript:`, unsafe SVGs, and control characters), and sanitized upstream error messages. |
| Prototype Pollution & Unbounded `req.body` Spreads | `server.ts`, `src/services/api.ts`, `src/utils/session.ts`, `src/utils/security.ts` | — | `...req.body` spreads and `JSON.parse` on storage/disk could merge `__proto__`/`constructor`/`prototype` keys or unvalidated types. | High | Fixed | Added recursive `stripDangerousKeys` middleware and storage guards, removed all `...req.body` spreads, and replaced them with explicit allowlisted field extraction, type checks, ISO date checks, and length bounds. |
| Missing Transport Security Headers & Production HTTPS Redirect | `server.ts` | 13–62 | Express lacked defensive HTTP headers and production HTTPS redirection. | Medium | Fixed | Enabled `trust proxy`, set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`, and enforced HSTS + 301 HTTPS redirect in `production` (excluding loopback). |
| AI & Agent Surface Assessment | `package.json`, `src/`, `server.ts` | — | Evaluated AI/agent exposure for prompt injection, PII/secret leakage, and output integrity. | Informational | Verified | `@google/genai` exists only as an unused package dependency; zero LLM clients, agent endpoints, or prompt pipelines exist in runtime code. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Credential Hashing & Session Integrity | `server.ts`, `src/utils/security.ts` | Passwords use `scrypt` (server) and `PBKDF2-SHA256` (client) with constant-time comparison; Bearer tokens are HMAC-SHA256 signed with an in-memory ephemeral secret fallback and logout revocation tracking. |
| Input & Prototype Validation | `server.ts`, `src/utils/security.ts` | All request bodies, cached JSON, and resource IDs pass recursive `__proto__`/`constructor`/`prototype` stripping, regex ID checks, date validation, and numeric bounds. |
| Cloud Rules & PII Isolation | `firestore.rules`, `firebase-blueprint.json` | Default-deny policy restricts `/users/{userId}` reads/writes to the verified account owner or Level 1 admin and blocks any shadow `password` key writes. |
| Dependency Audit | `package.json`, `package-lock.json`, `bun.lock` | Read-only `bun audit` / `npm audit` executed: flagged advisories in `xlsx` (prototype pollution / ReDoS, no upstream patch available—mitigated by `stripDangerousKeys` on imported records and trusted staff/admin import RBAC), `vite` (dev-only), `dompurify` (transitive via `jspdf`), `proxy-addr`, `body-parser`, `re2js`, and `@grpc/grpc-js`. |

## PoC Verification

### 1. Direct Login & Credential Bypass Prevention
#### Summary
| Field | Value |
|---|---|
| Issue Type | Authentication Bypass / Hardcoded Credentials |
| Impact | Critical |
| Affected File | `src/components/auth/LoginModal.tsx`, `server.ts` |
| Test Scenario | Attempt to log in as a Level 1 Admin via the removed `"DIRECT"` tab, submit empty/`"123456"`/`"123"` default passwords, or call `POST /api/auth/login` with an unconfigured account. |

#### How It Was Fixed
Removed the unauthenticated `"DIRECT"` login mode and all hardcoded passwords. Accounts without a configured hash require an explicit >= 6 character initial password via `POST /api/auth/first-password` (or `setupFirstTimePassword`) and subsequent logins require constant-time hash verification.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Login modal renders in `src/components/auth/LoginModal.tsx:300-586` | Only account selection with password verification (or first-time setup) and verified Google visitor login exist |
| 2 | `POST /api/auth/login` runs `verifyServerPassword` (`server.ts:535-565`) | Rejects `"123456"` / unset accounts with `403 requiresInitialSetup` and invalid passwords with `401` |
| 3 | `POST /api/users/:id/change-password` (`server.ts:764-800`) | Rejects `isAdminOverride: true` from non-Level-1 tokens (`403`) |

#### Conclusion
**Fix Verified** - Privileged accounts cannot be accessed without verifying a valid salted cryptographic password hash.

---

### 2. Unauthenticated Write & Prototype Pollution Blocking
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Access Control & Prototype Pollution |
| Impact | Critical |
| Affected File | `server.ts:46-54, 290-307, 650-980` |
| Test Scenario | Send an unauthenticated `POST /api/database/reset` or a `PUT /api/students/std-1` payload containing `{"__proto__": {"isAdmin": true}, "firstName": "Test"}` using a Level 3 teacher token. |

#### How It Was Fixed
Added global `stripDangerousKeys` middleware and strict `requireAuth` + `requireRole` guards on every mutating endpoint, plus dorm-ownership checks for Level 3 teacher attendance submissions.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | JSON body middleware calls `stripDangerousKeys(req.body)` (`server.ts:47-51`) | `__proto__`, `constructor`, and `prototype` keys are stripped before reaching handlers |
| 2 | Unauthenticated `POST /api/database/reset` hits `requireAuth` (`server.ts:292-296, 855`) | Immediately rejected with HTTP `401` |
| 3 | Level 3 token calling `PUT /api/students/std-1` hits `requireRole([1, 2])` (`server.ts:299-307, 621`) | Immediately rejected with HTTP `403` |

#### Conclusion
**Fix Verified** - All state-changing API routes require a valid HMAC-signed Bearer token with matching role and dormitory scope.

---

### 3. HTML Report XSS & Unsafe URL Scheme Prevention
#### Summary
| Field | Value |
|---|---|
| Issue Type | Stored/Reflected HTML Script Injection in Exports |
| Impact | High |
| Affected File | `src/utils/security.ts`, `src/utils/studentSearchReportExporter.ts`, `src/utils/htmlReportExporter.ts` |
| Test Scenario | Export a report when a student `firstName` contains `<img src=x onerror=alert(1)>` or `schoolLogoUrl` contains `javascript:alert(1)`. |

#### How It Was Fixed
All interpolated fields pass through `escapeHtml` / `escapeAttr`, rendered HTML fragments pass through `sanitizeHtmlFragment`, image URLs pass through `sanitizeSafeImageUrl`, and popup windows open via `openSafeWindowUrl` (`noopener,noreferrer`).

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `schoolLogoUrl` enters `sanitizeSafeImageUrl` (`src/utils/security.ts:66-128`) | `javascript:` scheme is rejected and returns `""` |
| 2 | Student `firstName` enters `escapeHtml` (`src/utils/security.ts:5-14`) | `<` and `>` become `&lt;` and `&gt;` before entering report HTML |
| 3 | Cloned print markup passes `sanitizeHtmlFragment` (`src/utils/htmlReportExporter.ts`) | `<script>`, `<iframe>`, and `on*` attributes are stripped |

#### Conclusion
**Fix Verified** - Injected HTML/script payloads and dangerous URL schemes cannot execute in exported HTML documents or print windows.

---

### 4. Cloud Database Shadow-Field & Privilege Escalation Rejection
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unrestricted Database Access & Privilege Escalation |
| Impact | Critical |
| Affected File | `firestore.rules:114-275` |
| Test Scenario | Attempt an unauthenticated read of `/users/user-5` or a verified Level 3 user attempting to update `/users/{ownUid}` with `{"roleLevel": 1, "password": "123"}`. |

#### How It Was Fixed
Deployed strict rules denying unauthenticated access, isolating `/users/{userId}` PII to owners/admins, forbidding the `password` key in `isValidUserProfile`, and locking `role`/`roleLevel`/`roleCategory` fields on owner updates.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Unauthenticated read on `/users/user-5` evaluates `isOwner(userId) || isAdmin()` (`firestore.rules:205`) | Returns `PERMISSION_DENIED` |
| 2 | Payload with `"password"` evaluates `isValidUserProfile(incoming())` (`firestore.rules:115`) | `!('password' in data)` fails and returns `PERMISSION_DENIED` |
| 3 | Non-admin modifying `roleLevel` fails `incoming().roleLevel == existing().roleLevel` and `affectedKeys().hasOnly(...)` (`firestore.rules:218-223`) | Returns `PERMISSION_DENIED` |

#### Conclusion
**Fix Verified** - Database rules block unauthorized reads, plaintext password writes, shadow fields, and role escalation.

---

### 5. AI & Agent Prompt Injection / Data Leakage Check
#### Summary
| Field | Value |
|---|---|
| Issue Type | AI Prompt Injection & Sensitive Data Exposure Assessment |
| Impact | Low (No Active AI Runtime) |
| Affected File | `package.json`, `src/`, `server.ts` |
| Test Scenario | Audit codebase for any `@google/genai` imports, LLM prompt construction, chat/agent handlers, or AI API key reads that could process untrusted user input or leak PII/secrets. |

#### How It Was Fixed
Verified via full repository scan that `@google/genai` has zero imports or invocations across client and server files, and no AI/agent endpoints or chatbots exist in the application.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Search for `@google/genai`, `GoogleGenAI`, or prompt handlers across `src/` and `server.ts` | Zero matches found |
| 2 | Inspect `server.ts` routes and client services | No LLM prompts, tool-calling agents, or `GEMINI_API_KEY` usages exist |

#### Conclusion
**Fix Verified** - Prompt injection and AI-driven PII/secret leakage are not reachable because no AI/agent runtime is active in application code.
