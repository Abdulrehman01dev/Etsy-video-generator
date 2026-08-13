import { getDrawOps } from "./animation";
import type { EffectId, FitMode, ProductImage } from "./types";

export function drawCoverOrContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  scale: number,
  fit: FitMode,
) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih || dw <= 0 || dh <= 0) return;

  const imageRatio = iw / ih;
  const boxRatio = dw / dh;
  let w: number;
  let h: number;

  if (fit === "cover") {
    if (imageRatio > boxRatio) {
      h = dh * scale;
      w = h * imageRatio;
    } else {
      w = dw * scale;
      h = w / imageRatio;
    }
  } else if (imageRatio > boxRatio) {
    w = dw * scale;
    h = w / imageRatio;
  } else {
    h = dh * scale;
    w = h / imageRatio;
  }

  const x = dx + (dw - w) / 2;
  const y = dy + (dh - h) / 2;
  ctx.drawImage(image, x, y, w, h);
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  images: ProductImage[],
  options: {
    time: number;
    duration: number;
    effect: EffectId;
    zoom: number;
    fit: FitMode;
    background: string;
    width: number;
    height: number;
  },
) {
  const { width, height, background } = options;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (images.length === 0) return;

  const ops = getDrawOps(
    options.effect,
    options.time,
    options.duration,
    images.length,
    width,
    height,
    options.zoom,
  );

  for (const op of ops) {
    const item = images[op.imageIndex];
    if (!item) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(op.destX, op.destY, op.destW, op.destH);
    ctx.clip();
    ctx.globalAlpha = op.opacity;
    drawCoverOrContain(
      ctx,
      item.image,
      op.destX,
      op.destY,
      op.destW,
      op.destH,
      op.scale,
      options.fit,
    );
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

export async function loadProductImage(file: File): Promise<ProductImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Could not read ${file.name}`));
    });
  }
  return {
    id: crypto.randomUUID(),
    file,
    url,
    image,
  };
}
