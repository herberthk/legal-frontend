/**
 * Resizes an image file to fit within the specified dimensions while maintaining aspect ratio.
 * If the image is already smaller than the target dimensions, it returns the original file.
 */
export async function resizeImage(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Create an image object
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = (e) => reject(e);

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Check if resizing is needed
      if (width <= maxWidth && height <= maxHeight) {
        resolve(file);
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Use better image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas to Blob conversion failed"));
            return;
          }
          // Create a new File object from the blob
          const resizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        file.type,
        0.9 // Quality setting
      );
    };

    img.onerror = (e) => reject(e);

    // Read the file
    reader.readAsDataURL(file);
  });
}
