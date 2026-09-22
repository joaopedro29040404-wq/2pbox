export type ImageOptimizationOptions = {
  maxDimension?: number;
  quality?: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    image.src = url;
  });
}

export async function optimizeImageForStorage(
  file: File,
  { maxDimension = 1600, quality = 0.82 }: ImageOptimizationOptions = {},
): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;

  try {
    const image = 'createImageBitmap' in window
      ? await createImageBitmap(file)
      : await loadImage(file);

    const sourceWidth = image instanceof ImageBitmap ? image.width : image.naturalWidth;
    const sourceHeight = image instanceof ImageBitmap ? image.height : image.naturalHeight;
    if (!sourceWidth || !sourceHeight) return file;

    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image as CanvasImageSource, 0, 0, width, height);

    if (image instanceof ImageBitmap) image.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', quality);
    });
    if (!blob || blob.size >= file.size * 0.95) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'produto';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file;
  }
}
