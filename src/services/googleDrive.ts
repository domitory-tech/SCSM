import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { initializeApp, getApps, getApp } from "firebase/app";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/drive");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("ไม่สามารถรับ OAuth Access Token จาก Google ได้");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Google Drive Auth Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export async function uploadImageToGoogleDrive(
  file: File | Blob,
  fileName: string = `avatar_${Date.now()}.jpg`,
  folderId: string = "1K7PFEk9ylOYLBtMHFijwPkzB3Xl13UfQ"
): Promise<{ fileId: string; webViewLink: string; directUrl: string }> {
  let token = cachedAccessToken;
  if (!token) {
    const authResult = await signInWithGoogleDrive();
    token = authResult.accessToken;
  }

  const mimeType = file.type || "image/jpeg";
  const metadata: Record<string, any> = {
    name: fileName,
    mimeType
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const fileArrayBuffer = await file.arrayBuffer();

  const multipartBlob = new Blob([
    delimiter,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
    fileArrayBuffer,
    closeDelim
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBlob
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    if (uploadRes.status === 401) {
      cachedAccessToken = null;
    }
    throw new Error(`เกิดข้อผิดพลาดในการอัปโหลดไปยัง Google Drive (${uploadRes.status}): ${errText}`);
  }

  const fileData = await uploadRes.json();
  const fileId = fileData.id;

  // Set file permissions to 'anyone' with 'reader' role so image displays publicly as avatar
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone"
      })
    });
  } catch (permErr) {
    console.warn("Setting public permission failed:", permErr);
  }

  const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  return {
    fileId,
    webViewLink: fileData.webViewLink || directUrl,
    directUrl
  };
}
