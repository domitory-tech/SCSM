import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  writeBatch
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Database with configured database ID if provided
const customDbId = (firebaseConfig as any).firestoreDatabaseId || (firebaseConfig as any).databaseId || "(default)";
export const db = customDbId && customDbId !== "(default)"
  ? getFirestore(app, customDbId)
  : getFirestore(app);

export const auth = getAuth(app);

async function testConnection() {
  try {
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
}

export type FirebaseConnectionStatus = CloudConnectionStatus;

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
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

// Check connection to central cloud database safely
export async function checkFirebaseConnection(): Promise<CloudConnectionStatus> {
  const startTime = Date.now();
  try {
    const testDocRef = doc(db, "system_settings", "config");
    const pingTask = getDoc(testDocRef);

    await withTimeout(pingTask, 4000);

    const latency = Date.now() - startTime;
    return {
      isConnected: true,
      lastChecked: new Date().toLocaleTimeString("th-TH"),
      error: null,
      latencyMs: latency
    };
  } catch (err: any) {
    console.warn("Cloud database ping attempt failed:", err?.message || err);
    return {
      isConnected: false,
      lastChecked: new Date().toLocaleTimeString("th-TH"),
      error: err?.message || "Failed to reach central database in time",
      latencyMs: null
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
  idKey: string = "id"
) {
  if (!items || items.length === 0) return 0;
  const CHUNK_SIZE = 400;
  let count = 0;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      const docId = item[idKey] || item.id || `doc-${Date.now()}-${Math.random()}`;
      const docRef = doc(db, collectionName, docId);
      const cleaned = cleanFirestoreData(item);
      batch.set(docRef, cleaned, { merge: true });
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
    await batch.commit();
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
