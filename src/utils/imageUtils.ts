/**
 * Utility functions for image compression and resizing before storing in Firestore
 * to keep document sizes compact and within security rule bounds.
 */

function renderImageToSizedJpeg(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  initialQuality: number,
  maxDataUrlLength: number
): string {
  let targetW = maxWidth;
  let targetH = maxHeight;
  const qualitySteps = [initialQuality, 0.7, 0.56, 0.44, 0.34];

  for (let scaleStep = 0; scaleStep < 3; scaleStep++) {
    let width = img.width || targetW;
    let height = img.height || targetH;
    if (width > height) {
      if (width > targetW) {
        height = Math.max(1, Math.round((height * targetW) / width));
        width = targetW;
      }
    } else {
      if (height > targetH) {
        width = Math.max(1, Math.round((width * targetH) / height));
        height = targetH;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const q of qualitySteps) {
      const compressed = canvas.toDataURL("image/jpeg", q);
      if (compressed.length <= maxDataUrlLength) {
        return compressed;
      }
    }

    targetW = Math.round(targetW * 0.72);
    targetH = Math.round(targetH * 0.72);
  }

  // Final fallback compact thumbnail
  for (const dim of [96, 64]) {
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = dim;
    fallbackCanvas.height = dim;
    const fallbackCtx = fallbackCanvas.getContext("2d");
    if (!fallbackCtx) return "";
    fallbackCtx.fillStyle = "#FFFFFF";
    fallbackCtx.fillRect(0, 0, dim, dim);
    fallbackCtx.drawImage(img, 0, 0, dim, dim);
    const out = fallbackCanvas.toDataURL("image/jpeg", 0.35);
    if (out.length <= maxDataUrlLength || dim === 64) {
      return out;
    }
  }
  return "";
}

export const compressImageFile = (
  file: File,
  maxWidth = 240,
  maxHeight = 240,
  quality = 0.82,
  maxDataUrlLength = 45000
): Promise<string> => {
  return new Promise((resolve) => {
    // Reject unsafe SVG uploads containing embedded scripts or event handlers
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string) || "";
        const lower = result.toLowerCase();
        if (lower.includes("javascript:") || lower.includes("phnjcmlwd") || lower.includes("<script")) {
          resolve("");
          return;
        }
        resolve(result.length <= maxDataUrlLength ? result : "");
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => resolve("");
    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) || "";
      if (!dataUrl) {
        resolve("");
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(dataUrl.length <= maxDataUrlLength ? dataUrl : "");
      img.onload = () => {
        const compressed = renderImageToSizedJpeg(img, maxWidth, maxHeight, quality, maxDataUrlLength);
        resolve(compressed || (dataUrl.length <= maxDataUrlLength ? dataUrl : ""));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

export const compressDataUrlIfNeeded = (
  dataUrl: string,
  maxWidth = 240,
  maxHeight = 240,
  quality = 0.82,
  maxDataUrlLength = 45000
): Promise<string> => {
  return new Promise((resolve) => {
    if (
      !dataUrl ||
      !dataUrl.startsWith("data:image/") ||
      dataUrl.includes("image/svg+xml") ||
      dataUrl.length <= maxDataUrlLength
    ) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const compressed = renderImageToSizedJpeg(img, maxWidth, maxHeight, quality, maxDataUrlLength);
      resolve(compressed || dataUrl);
    };
    img.src = dataUrl;
  });
};
