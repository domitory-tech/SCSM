/**
 * Utility functions for image compression and resizing before storing in Firestore
 * to avoid exceeding Firestore's 1MB document size limit.
 */

export const compressImageFile = (
  file: File,
  maxWidth = 250,
  maxHeight = 250,
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    // If it's SVG, SVG files are text-based vector graphics and already very small.
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
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
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Fill white background for transparent PNGs converted to JPEG
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

export const compressDataUrlIfNeeded = (
  dataUrl: string,
  maxWidth = 250,
  maxHeight = 250,
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    if (
      !dataUrl ||
      !dataUrl.startsWith("data:image/") ||
      dataUrl.includes("image/svg+xml") ||
      dataUrl.length < 50000 // If smaller than ~50KB, no need to compress
    ) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed);
    };
    img.src = dataUrl;
  });
};
