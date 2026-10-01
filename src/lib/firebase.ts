import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if provided
const customDbId = (firebaseConfig as any).firestoreDatabaseId || (firebaseConfig as any).databaseId || "ai-studio-c3d2ba83-2c19-424a-a0e5-96002be8d733";
export const db = customDbId && customDbId !== "(default)"
  ? getFirestore(app, customDbId)
  : getFirestore(app);

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.warn("Firestore Error:", JSON.stringify(errInfo));
  return errInfo;
}

export const FIREBASE_PROJECT_INFO = {
  projectName: "Student Counting System",
  projectId: firebaseConfig.projectId,
  databaseId: customDbId || "(default)",
  userEmail: "domitory@pcccr.ac.th",
  appId: firebaseConfig.appId,
  authDomain: firebaseConfig.authDomain
};

export interface FirebaseConnectionStatus {
  isConnected: boolean;
  lastChecked: string | null;
  error: string | null;
  latencyMs: number | null;
}

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

// Check connection to Firestore safely
export async function checkFirebaseConnection(): Promise<FirebaseConnectionStatus> {
  const startTime = Date.now();
  try {
    // Perform a lightweight read ping rather than a write to avoid polluting Firestore write streams
    const testDocRef = doc(db, "system_settings", "config");
    const pingTask = getDoc(testDocRef);

    // Timeout at 4 seconds so UI never hangs or waits 10s for SDK timeout
    await withTimeout(pingTask, 4000);
    
    const latency = Date.now() - startTime;
    return {
      isConnected: true,
      lastChecked: new Date().toLocaleTimeString("th-TH"),
      error: null,
      latencyMs: latency
    };
  } catch (err: any) {
    console.warn("Firebase ping attempt failed:", err?.message || err);
    return {
      isConnected: false,
      lastChecked: new Date().toLocaleTimeString("th-TH"),
      error: err?.message || "Failed to reach Firestore in time",
      latencyMs: null
    };
  }
}

// Recursively remove undefined values from objects and arrays so Firestore never throws "Unsupported field value: undefined"
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// Chunked batch helper to bypass Firestore 500 operations limit
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
    await batch.commit();
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

// Seed / Migrate initial dataset from backend to Firebase Firestore
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

  console.log(`Firebase initial seed completed successfully (${totalCount} documents).`);
  return totalCount;
}
