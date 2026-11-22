import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  writeBatch
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  User
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Database with configured database ID if provided
const customDbId = (firebaseConfig as any).firestoreDatabaseId || (firebaseConfig as any).databaseId || "(default)";
export const db = customDbId && customDbId !== "(default)"
  ? getFirestore(app, customDbId)
  : getFirestore(app);

export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = (firebaseConfig as any).projectId || "";
export const FIREBASE_DATABASE_ID = customDbId;

export async function ensureAuthReady(): Promise<void> {
  try {
    if (typeof (auth as any).authStateReady === "function") {
      await (auth as any).authStateReady();
    }
  } catch {
    // Ignore auth readiness edge errors
  }
}

export type FirestoreAccessIssueCode =
  | "AUTH_REQUIRED"
  | "ANONYMOUS_AUTH_DISABLED"
  | "UNAUTHORIZED_DOMAIN"
  | "PERMISSION_DENIED"
  | "POPUP_BLOCKED"
  | "OFFLINE";

export interface FirestoreAccessIssue {
  code: FirestoreAccessIssueCode;
  message: string;
  hostname?: string;
  path?: string;
}

let currentAccessIssue: FirestoreAccessIssue | null = null;
const accessIssueListeners = new Set<(issue: FirestoreAccessIssue | null) => void>();

export function getFirestoreAccessIssue(): FirestoreAccessIssue | null {
  return currentAccessIssue;
}

export function setFirestoreAccessIssue(issue: FirestoreAccessIssue | null): void {
  // Do not accidentally clear ANONYMOUS_AUTH_DISABLED on read queries; only clear it when auth succeeds
  if (issue === null && currentAccessIssue?.code === "ANONYMOUS_AUTH_DISABLED") {
    return;
  }
  const same =
    currentAccessIssue?.code === issue?.code &&
    currentAccessIssue?.message === issue?.message &&
    currentAccessIssue?.hostname === issue?.hostname;
  if (same) return;
  currentAccessIssue = issue;
  accessIssueListeners.forEach((listener) => {
    try {
      listener(currentAccessIssue);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeFirestoreAccessIssue(
  listener: (issue: FirestoreAccessIssue | null) => void
): () => void {
  accessIssueListeners.add(listener);
  listener(currentAccessIssue);
  return () => {
    accessIssueListeners.delete(listener);
  };
}

export function getCurrentHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname || "";
}

let inFlightAnonymousSignIn: Promise<User | null> | null = null;

/**
 * Ensures the browser has a valid Firebase Auth session (Google or silent Anonymous Auth)
 * so all authorized in-app users can write to Firestore without Google login popups.
 */
export async function ensureFirebaseAuthSession(): Promise<User | null> {
  await ensureAuthReady();
  if (auth.currentUser) {
    if (currentAccessIssue?.code === "ANONYMOUS_AUTH_DISABLED" || currentAccessIssue?.code === "AUTH_REQUIRED") {
      currentAccessIssue = null;
      accessIssueListeners.forEach((l) => {
        try { l(null); } catch {}
      });
    }
    return auth.currentUser;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return null;
  }

  if (inFlightAnonymousSignIn) {
    return inFlightAnonymousSignIn;
  }

  inFlightAnonymousSignIn = (async () => {
    try {
      const cred = await withTimeout(signInAnonymously(auth), 8000);
      currentAccessIssue = null;
      accessIssueListeners.forEach((l) => {
        try { l(null); } catch {}
      });
      return cred.user;
    } catch (err: any) {
      const code = String(err?.code || "").toLowerCase();
      if (code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation") {
        setFirestoreAccessIssue({
          code: "ANONYMOUS_AUTH_DISABLED",
          message: `ยังไม่ได้เปิดใช้งาน Anonymous Authentication ใน Firebase Console (โปรเจกต์ ${FIREBASE_PROJECT_ID}) กรุณาเปิดที่ Authentication -> Sign-in method -> Anonymous`,
          hostname: getCurrentHostname()
        });
      } else {
        console.warn("Silent Firebase Anonymous sign-in skipped:", err?.message || err);
      }
      return null;
    } finally {
      inFlightAnonymousSignIn = null;
    }
  })();

  return inFlightAnonymousSignIn;
}

export function classifyFirestoreError(
  error: unknown,
  path: string | null = null,
  isRestrictedUserCollection: boolean = false
): void {
  const errCode = String((error as any)?.code || "").toLowerCase();
  const errMsg = error instanceof Error ? error.message : String(error || "");
  const lowerMsg = errMsg.toLowerCase();
  const hostname = getCurrentHostname();

  const isPermDenied =
    errCode.includes("permission-denied") ||
    errCode.includes("unauthenticated") ||
    lowerMsg.includes("missing or insufficient permissions") ||
    lowerMsg.includes("permission_denied") ||
    lowerMsg.includes("permission-denied");

  if (isPermDenied) {
    // Non-admin/visitor sessions intentionally cannot read /users (PII protection);
    // do not treat that as a global Firestore connection failure.
    if (isRestrictedUserCollection) {
      return;
    }

    if (!auth.currentUser) {
      if (currentAccessIssue?.code !== "ANONYMOUS_AUTH_DISABLED") {
        setFirestoreAccessIssue({
          code: "AUTH_REQUIRED",
          message: `ยังไม่มีเซสชันยืนยันตัวตนกับ Firebase สำหรับเขียนข้อมูล (${path || "firestore"})`,
          hostname,
          path: path || undefined
        });
      }
      return;
    }

    const actorLabel = auth.currentUser.email || (auth.currentUser.isAnonymous ? "Anonymous Auth" : auth.currentUser.uid);
    setFirestoreAccessIssue({
      code: "PERMISSION_DENIED",
      message: `เซสชัน (${actorLabel}) ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้ (${path || "firestore"})`,
      hostname,
      path: path || undefined
    });
    return;
  }

  if (
    errCode.includes("unavailable") ||
    lowerMsg.includes("the client is offline") ||
    lowerMsg.includes("timeout after") ||
    lowerMsg.includes("network")
  ) {
    setFirestoreAccessIssue({
      code: "OFFLINE",
      message: "ไม่สามารถเชื่อมต่อฐานข้อมูล Firestore ได้ชั่วคราว กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
      hostname,
      path: path || undefined
    });
  }
}

export async function signInWithGoogleAndRefresh(): Promise<User> {
  const hostname = getCurrentHostname();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    if (!result.user?.emailVerified) {
      const err: any = new Error("บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล");
      err.code = "auth/email-not-verified";
      throw err;
    }
    currentAccessIssue = null;
    accessIssueListeners.forEach((l) => {
      try { l(null); } catch {}
    });
    return result.user;
  } catch (err: any) {
    const code = String(err?.code || "");
    if (code === "auth/unauthorized-domain") {
      const msg = `โดเมน "${hostname}" ยังไม่ได้รับอนุญาตใน Firebase Authentication (ต้องเพิ่มโดเมนนี้ใน Firebase Console -> Authentication -> Settings -> Authorized domains)`;
      setFirestoreAccessIssue({
        code: "UNAUTHORIZED_DOMAIN",
        message: msg,
        hostname
      });
      const wrapped: any = new Error(msg);
      wrapped.code = code;
      throw wrapped;
    }
    if (code === "auth/popup-blocked") {
      const msg = "เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ Google กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่อีกครั้ง";
      setFirestoreAccessIssue({
        code: "POPUP_BLOCKED",
        message: msg,
        hostname
      });
      const wrapped: any = new Error(msg);
      wrapped.code = code;
      throw wrapped;
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      const wrapped: any = new Error("ยกเลิกการเข้าสู่ระบบด้วย Google กรุณาลองใหม่อีกครั้ง");
      wrapped.code = code;
      throw wrapped;
    }
    if (code === "auth/operation-not-allowed") {
      const msg = "ยังไม่ได้เปิดใช้งาน Google Sign-In ใน Firebase Authentication (Authentication -> Sign-in method)";
      const wrapped: any = new Error(msg);
      wrapped.code = code;
      throw wrapped;
    }
    if (code === "auth/network-request-failed") {
      const msg = "เชื่อมต่อระบบยืนยันตัวตน Google ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต";
      const wrapped: any = new Error(msg);
      wrapped.code = code;
      throw wrapped;
    }
    throw err;
  }
}

async function testConnection() {
  try {
    await ensureFirebaseAuthSession();
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
if (typeof window !== "undefined") {
  testConnection();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export type FirestoreErrorInfo = DatabaseErrorInfo;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow: boolean = false) {
  const currentUser = auth.currentUser;
  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo: currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  const serialized = JSON.stringify(errInfo);
  console.error("Firestore Error: ", serialized);
  classifyFirestoreError(error, path, path === "users");
  if (shouldThrow) {
    throw new Error(serialized);
  }
  return errInfo;
}

export const CLOUD_PROJECT_INFO = {
  projectName: "Student Counting System",
};

export interface CloudConnectionStatus {
  isConnected: boolean;
  lastChecked: string | null;
  error: string | null;
  latencyMs: number | null;
  settings?: Record<string, any> | null;
}

export type FirebaseConnectionStatus = CloudConnectionStatus;

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Check live connection to central cloud database from server safely
export async function checkFirebaseConnection(): Promise<CloudConnectionStatus> {
  const startTime = Date.now();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const offlineMsg = "ไม่สามารถเชื่อมต่อฐานข้อมูล Firestore ได้เนื่องจากอุปกรณ์ออฟไลน์";
    setFirestoreAccessIssue({
      code: "OFFLINE",
      message: offlineMsg,
      hostname: getCurrentHostname(),
      path: "system_settings/config"
    });
    return {
      isConnected: false,
      lastChecked: new Date().toLocaleTimeString("th-TH"),
      error: offlineMsg,
      latencyMs: null,
      settings: null
    };
  }

  try {
    await ensureFirebaseAuthSession();
    const testDocRef = doc(db, "system_settings", "config");
    const snap = await withTimeout(getDocFromServer(testDocRef), 8000);

    const latency = Date.now() - startTime;
    setFirestoreAccessIssue(null);
    return {
      isConnected: true,
      lastChecked: new Date().toLocaleTimeString("th-TH"),
      error: null,
      latencyMs: latency,
      settings: snap.exists() ? (snap.data() as Record<string, any>) : null
    };
  } catch (err: any) {
    console.warn("Cloud database ping attempt failed:", err?.message || err);
    classifyFirestoreError(err, "system_settings/config", false);
    return {
      isConnected: false,
      lastChecked: new Date().toLocaleTimeString("th-TH"),
      error: err?.message || "Failed to reach central database in time",
      latencyMs: null,
      settings: null
    };
  }
}

// Recursively remove undefined/null object fields before persistence
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined && item !== null)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// Chunked batch helper to bypass batch operation limits
export async function commitChunkedSetDocs(
  collectionName: string,
  items: any[],
  idKey: string = "id",
  merge: boolean = true
) {
  if (!items || items.length === 0) return 0;
  await ensureFirebaseAuthSession();
  const CHUNK_SIZE = 400;
  let count = 0;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      const docId = item[idKey] || item.id || `doc-${Date.now()}-${Math.random()}`;
      const docRef = doc(db, collectionName, docId);
      const cleaned = cleanFirestoreData(item);
      if (merge) {
        batch.set(docRef, cleaned, { merge: true });
      } else {
        batch.set(docRef, cleaned);
      }
      count++;
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, collectionName, true);
    }
  }
  return count;
}

export async function commitChunkedDeleteDocs(
  collectionName: string,
  docIds: string[]
) {
  if (!docIds || docIds.length === 0) return 0;
  await ensureFirebaseAuthSession();
  const CHUNK_SIZE = 400;
  let count = 0;
  for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
    const chunk = docIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((id) => {
      const docRef = doc(db, collectionName, id);
      batch.delete(docRef);
      count++;
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, collectionName, true);
    }
  }
  return count;
}

// Seed / Migrate initial dataset to cloud database
export async function seedInitialFirebaseData(initialData: {
  dorms?: any[];
  students?: any[];
  users?: any[];
  notices?: any[];
  attendance?: any[];
}) {
  let totalCount = 0;
  if (initialData.dorms) {
    totalCount += await commitChunkedSetDocs("dorms", initialData.dorms);
  }
  if (initialData.users) {
    totalCount += await commitChunkedSetDocs("users", initialData.users);
  }
  if (initialData.students) {
    totalCount += await commitChunkedSetDocs("students", initialData.students);
  }
  if (initialData.notices) {
    totalCount += await commitChunkedSetDocs("notices", initialData.notices);
  }
  if (initialData.attendance) {
    totalCount += await commitChunkedSetDocs("attendance", initialData.attendance);
  }

  console.log(`Initial database seed completed successfully (${totalCount} documents).`);
  return totalCount;
}
