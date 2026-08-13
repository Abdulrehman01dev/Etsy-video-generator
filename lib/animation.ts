import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, lerp } from "./easing";
import type { DrawOp, EffectId } from "./types";

export function getDrawOps(
  effect: EffectId,
  time: number,
  duration: number,
  count: number,
  width: number,
  height: number,
  zoom: number,
): DrawOp[] {
  if (count <= 0 || duration <= 0) return [];
  const t = clamp(time, 0, duration);
  switch (effect) {
    case "gentle-reveal":
      return gentleReveal(t, duration, count, width, height, zoom);
    case "scale-in":
      return scaleIn(t, duration, count, width, height, zoom);
    case "gallery-glide":
      return galleryGlide(t, duration, count, width, height, zoom);
    case "rapid-showcase":
      return rapidShowcase(t, duration, count, width, height, zoom);
  }
}

function gentleReveal(
  t: number,
  duration: number,
  count: number,
  width: number,
  height: number,
  zoom: number,
): DrawOp[] {
  const slot = duration / count;
  const fade = Math.min(0.4, slot * 0.2);
  const ops: DrawOp[] = [];

  for (let i = 0; i < count; i += 1) {
    const start = i === 0 ? 0 : i * slot - fade;
    const end = i === count - 1 ? duration : (i + 1) * slot;
    if (t < start || t > end) continue;

    const span = Math.max(0.0001, end - start);
    const local = clamp((t - start) / span, 0, 1);
    const scale = 1 + zoom * easeInOutCubic(local);

    let opacity = 1;
    if (t < start + fade) {
      opacity = clamp((t - start) / fade, 0, 1);
    } else if (i < count - 1 && t > end - fade) {
      opacity = clamp((end - t) / fade, 0, 1);
    }

    if (opacity <= 0.001) continue;
    ops.push({
      imageIndex: i,
      destX: 0,
      destY: 0,
      destW: width,
      destH: height,
      scale,
      opacity,
    });
  }

  return ops;
}

function scaleIn(
  t: number,
  duration: number,
  count: number,
  width: number,
  height: number,
  zoom: number,
): DrawOp[] {
  const slot = duration / count;
  const ops: DrawOp[] = [];

  for (let i = 0; i < count; i += 1) {
    const start = i * slot;
    if (t < start) continue;

    const span = i === count - 1 ? Math.max(0.0001, duration - start) : slot;
    const local = clamp((t - start) / span, 0, 1);
    const intro = clamp((t - start) / Math.min(0.55, slot * 0.5), 0, 1);
    const enter = lerp(0.78, 1, easeOutCubic(intro));
    const scale = enter + zoom * easeInOutCubic(local);
    const opacity = clamp((t - start) / 0.16, 0, 1);

    ops.push({
      imageIndex: i,
      destX: 0,
      destY: 0,
      destW: width,
      destH: height,
      scale,
      opacity,
    });
  }

  return ops;
}

function galleryGlide(
  t: number,
  duration: number,
  count: number,
  width: number,
  height: number,
  zoom: number,
): DrawOp[] {
  const progress = easeInOutCubic(clamp(t / duration, 0, 1));
  const cameraX = progress * Math.max(0, count - 1) * width;
  const ops: DrawOp[] = [];

  for (let i = 0; i < count; i += 1) {
    const x = i * width - cameraX;
    if (x + width < -2 || x > width + 2) continue;
    const centered = 1 - clamp(Math.abs(x) / width, 0, 1);
    const scale = 1 + zoom * lerp(0.15, 1, centered);

    ops.push({
      imageIndex: i,
      destX: x,
      destY: 0,
      destW: width,
      destH: height,
      scale,
      opacity: 1,
    });
  }

  return ops;
}

function rapidShowcase(
  t: number,
  duration: number,
  count: number,
  width: number,
  height: number,
  zoom: number,
): DrawOp[] {
  const slot = duration / count;

  for (let i = 0; i < count; i += 1) {
    const start = i * slot;
    const end = i === count - 1 ? duration : (i + 1) * slot;
    if (t < start || t > end) continue;

    const local = clamp((t - start) / Math.max(0.0001, end - start), 0, 1);
    const punch = 0.2;
    let scale: number;
    let opacity = 1;

    if (local < punch) {
      const p = clamp(local / punch, 0, 1);
      scale = lerp(1.1 + zoom * 0.35, 1 + zoom * 0.06, easeOutBack(p));
      opacity = clamp(local / 0.05, 0, 1);
    } else {
      scale = 1 + zoom * 0.06 + zoom * 0.2 * ((local - punch) / (1 - punch));
    }

    return [
      {
        imageIndex: i,
        destX: 0,
        destY: 0,
        destW: width,
        destH: height,
        scale: Math.max(0.9, scale),
        opacity,
      },
    ];
  }

  return [];
}
