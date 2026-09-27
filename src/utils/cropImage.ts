export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();

    const onLoad = () => {
      cleanup();
      resolve(image);
    };

    const onError = (err: any) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };

    image.addEventListener("load", onLoad);
    image.addEventListener("error", onError);

    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }

    image.src = url;

    // Resolve synchronously if image is already loaded/cached
    if (image.complete && (image.naturalWidth > 0 || image.width > 0)) {
      cleanup();
      resolve(image);
    }
  });

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0
): Promise<Blob | null> {
  const image = await createImage(imageSrc);

  const rotRad = getRadianAngle(rotation);
  const imgWidth = image.naturalWidth || image.width || 300;
  const imgHeight = image.naturalHeight || image.height || 300;

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    imgWidth,
    imgHeight,
    rotation
  );

  // Create intermediate canvas to hold the rotated image
  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = Math.max(1, Math.round(bBoxWidth));
  rotCanvas.height = Math.max(1, Math.round(bBoxHeight));
  const rotCtx = rotCanvas.getContext("2d");

  if (!rotCtx) {
    return null;
  }

  rotCtx.imageSmoothingEnabled = true;
  rotCtx.imageSmoothingQuality = "high";
  rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  rotCtx.rotate(rotRad);
  rotCtx.translate(-imgWidth / 2, -imgHeight / 2);
  rotCtx.drawImage(image, 0, 0);

  // Sanitize crop values
  const cropW = Number(pixelCrop?.width) > 0 ? Number(pixelCrop.width) : imgWidth;
  const cropH = Number(pixelCrop?.height) > 0 ? Number(pixelCrop.height) : imgHeight;
  const cropX = !isNaN(Number(pixelCrop?.x)) ? Number(pixelCrop.x) : 0;
  const cropY = !isNaN(Number(pixelCrop?.y)) ? Number(pixelCrop.y) : 0;

  // Ensure minimum 512px canvas so cropped images stay ultra-sharp on Retina/high-DPI screens
  const scaleFactor = Math.max(1, Math.min(4, Math.round(512 / Math.max(1, Math.max(cropW, cropH)))));
  const targetWidth = Math.max(1, Math.round(cropW * scaleFactor));
  const targetHeight = Math.max(1, Math.round(cropH * scaleFactor));

  // Create target canvas matching the cropped area
  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = targetWidth;
  croppedCanvas.height = targetHeight;
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    return null;
  }

  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = "high";

  // Pre-fill with white background so unpainted/transparent areas stay clean
  croppedCtx.fillStyle = "#FFFFFF";
  croppedCtx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw the cropped region from rotCanvas to high-res target canvas
  croppedCtx.drawImage(
    rotCanvas,
    Math.round(cropX),
    Math.round(cropY),
    Math.round(cropW),
    Math.round(cropH),
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve) => {
    // Timeout safeguard so promise NEVER hangs indefinitely
    const timeout = setTimeout(() => {
      try {
        const dataUrl = croppedCanvas.toDataURL("image/jpeg", 0.95);
        const arr = dataUrl.split(",");
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: mime }));
      } catch {
        resolve(null);
      }
    }, 2000);

    try {
      croppedCanvas.toBlob(
        (blob) => {
          clearTimeout(timeout);
          if (blob) {
            resolve(blob);
          } else {
            try {
              const dataUrl = croppedCanvas.toDataURL("image/jpeg", 0.95);
              const arr = dataUrl.split(",");
              const mime = arr[0].match(/:(.*?);/)![1];
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              resolve(new Blob([u8arr], { type: mime }));
            } catch {
              resolve(null);
            }
          }
        },
        "image/jpeg",
        0.95
      );
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}
