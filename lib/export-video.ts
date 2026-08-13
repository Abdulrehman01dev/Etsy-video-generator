import { renderFrame } from "./canvas";
import type { EffectId, FitMode, ProductImage } from "./types";

export type ExportOptions = {
  images: ProductImage[];
  effect: EffectId;
  duration: number;
  zoom: number;
  width: number;
  height: number;
  fit: FitMode;
  background: string;
  fps?: number;
  onProgress?: (progress: number) => void;
};

function yieldToMain() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function exportWithMediabunny(options: ExportOptions) {
  const {
    Output,
    Mp4OutputFormat,
    BufferTarget,
    CanvasSource,
    QUALITY_HIGH,
    canEncodeVideo,
  } = await import("mediabunny");

  if (!(await canEncodeVideo("avc"))) {
    throw new Error("H.264 encoding is not available in this browser.");
  }

  const fps = options.fps ?? 30;
  const totalFrames = Math.max(1, Math.round(options.duration * fps));
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    quality: QUALITY_HIGH,
  });

  output.addVideoTrack(videoSource, { frameRate: fps });
  await output.start();

  const frameDuration = 1 / fps;
  for (let i = 0; i < totalFrames; i += 1) {
    const time = Math.min(options.duration, i / fps);
    renderFrame(ctx, options.images, { ...options, time });
    await videoSource.add(i / fps, frameDuration);
    if (i % 4 === 0) {
      options.onProgress?.(i / totalFrames);
      await yieldToMain();
    }
  }

  await output.finalize();
  options.onProgress?.(1);

  const buffer = target.buffer;
  if (!buffer) throw new Error("Export produced an empty file.");
  return new Blob([buffer], { type: "video/mp4" });
}

function pickRecorderMime() {
  const types = [
    "video/mp4;codecs=avc1.4D0028",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function exportWithMediaRecorder(options: ExportOptions) {
  const fps = options.fps ?? 30;
  const mimeType = pickRecorderMime();
  if (!mimeType) {
    throw new Error("This browser cannot record video. Try Chrome or Edge.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  canvas.style.cssText = "position:fixed;left:-9999px;top:0;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    canvas.remove();
    throw new Error("Canvas is not available in this browser.");
  }

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];

  const blob = await new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Recording failed."));
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };

    renderFrame(ctx, options.images, { ...options, time: 0 });
    recorder.start(100);
    const started = performance.now();

    const tick = () => {
      const elapsed = (performance.now() - started) / 1000;
      if (elapsed >= options.duration) {
        renderFrame(ctx, options.images, { ...options, time: options.duration });
        options.onProgress?.(1);
        recorder.stop();
        return;
      }
      renderFrame(ctx, options.images, { ...options, time: elapsed });
      options.onProgress?.(elapsed / options.duration);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

  stream.getTracks().forEach((track) => track.stop());
  canvas.remove();
  return blob;
}

export async function exportVideo(options: ExportOptions) {
  try {
    return await exportWithMediabunny(options);
  } catch (error) {
    console.warn("MP4 encoder unavailable, falling back to MediaRecorder.", error);
    return exportWithMediaRecorder(options);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function extensionForBlob(blob: Blob) {
  if (blob.type.includes("mp4")) return "mp4";
  if (blob.type.includes("webm")) return "webm";
  return "mp4";
}
