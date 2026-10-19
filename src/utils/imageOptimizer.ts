/**
 * Client-side image optimization utility
 * Resizes and compresses images using HTML5 Canvas so they stay lightweight (< 150KB per image)
 * to comply with Firestore's 1 MiB (1,048,576 bytes) document size limit.
 */

export interface CompressionOptions {
  maxDimension?: number; // Max width or height in px (default: 1080)
  quality?: number; // 0 to 1 (default: 0.78)
  maxBytes?: number; // Target max size per image in bytes (default: 160KB)
}

/**
 * Compresses an image File (JPG, PNG, WEBP, HEIC, etc.) to a lightweight base64 data URL
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        return reject(new Error('Archivo de imagen vacío.'));
      }
      try {
        const compressed = await compressDataUrl(rawDataUrl, options);
        resolve(compressed);
      } catch (err) {
        // Fallback to raw if canvas fails
        resolve(rawDataUrl);
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a base64 data URL using HTML Canvas
 * If already a remote web URL (http/https), returns it as-is.
 */
export async function compressDataUrl(
  dataUrl: string,
  options: CompressionOptions = {}
): Promise<string> {
  // If it's a web URL (e.g. Google Drive direct link, Cloudinary, Imgur, CDN), no need to compress base64
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }

  // If not a data URL, return as is
  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  const {
    maxDimension = 1080,
    quality = 0.78,
    maxBytes = 160 * 1024, // 160 KB
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onerror = () => {
      // If error loading image, fallback to original
      resolve(dataUrl);
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect-ratio scaling
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Draw with high quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first (greatest compression ratio)
        let outputFormat = 'image/webp';
        let currentQuality = quality;
        let result = canvas.toDataURL(outputFormat, currentQuality);

        // Check if browser actually supports WebP export (Safari old versions might return png)
        if (!result.startsWith('data:image/webp')) {
          outputFormat = 'image/jpeg';
          result = canvas.toDataURL(outputFormat, currentQuality);
        }

        // Approximate base64 byte size
        const approximateBytes = (result.length * 3) / 4;

        // If still exceeding maxBytes, iteratively lower quality/dimensions
        if (approximateBytes > maxBytes) {
          currentQuality = 0.62;
          result = canvas.toDataURL(outputFormat, currentQuality);
        }

        const finalBytes = (result.length * 3) / 4;
        if (finalBytes > maxBytes) {
          // Re-scale canvas to 750px max if still too big
          const smallerDim = 750;
          let sWidth = width;
          let sHeight = height;
          if (sWidth > smallerDim || sHeight > smallerDim) {
            if (sWidth > sHeight) {
              sHeight = Math.round((sHeight * smallerDim) / sWidth);
              sWidth = smallerDim;
            } else {
              sWidth = Math.round((sWidth * smallerDim) / sHeight);
              sHeight = smallerDim;
            }
            canvas.width = sWidth;
            canvas.height = sHeight;
            ctx.drawImage(img, 0, 0, sWidth, sHeight);
            result = canvas.toDataURL(outputFormat, 0.6);
          }
        }

        resolve(result);
      } catch (err) {
        console.warn('Canvas compression error, using original data:', err);
        resolve(dataUrl);
      }
    };

    img.src = dataUrl;
  });
}

/**
 * Validates and compresses all images in a product object so the document
 * is strictly guaranteed to stay under Firestore's 1MB limit.
 */
export async function optimizeProductImages(
  images: string[],
  targetMaxDocBytes = 750 * 1024 // 750 KB total budget for images
): Promise<string[]> {
  if (!images || images.length === 0) return [];

  // Count how many are data URLs vs external links
  const dataUrlIndices: number[] = [];
  images.forEach((img, i) => {
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      dataUrlIndices.push(i);
    }
  });

  if (dataUrlIndices.length === 0) {
    return images; // All are external URLs, 0 bytes stored in document body!
  }

  // Budget per base64 image
  const budgetPerImage = Math.max(
    50 * 1024,
    Math.floor(targetMaxDocBytes / dataUrlIndices.length)
  );

  const optimized = await Promise.all(
    images.map(async (img) => {
      if (typeof img === 'string' && img.startsWith('data:image/')) {
        return await compressDataUrl(img, {
          maxDimension: dataUrlIndices.length > 3 ? 900 : 1080,
          quality: dataUrlIndices.length > 3 ? 0.72 : 0.78,
          maxBytes: budgetPerImage,
        });
      }
      return img;
    })
  );

  return optimized;
}
