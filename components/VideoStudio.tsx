"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderFrame, loadProductImage } from "@/lib/canvas";
import {
  downloadBlob,
  exportVideo,
  extensionForBlob,
} from "@/lib/export-video";
import {
  ASPECTS,
  BACKGROUNDS,
  DURATIONS,
  EFFECTS,
  type AspectId,
  type EffectId,
  type FitMode,
  type ProductImage,
} from "@/lib/types";

const MIN_IMAGES = 2;
const MAX_IMAGES = 10;

function formatTime(seconds: number) {
  const whole = Math.max(0, seconds);
  const m = Math.floor(whole / 60);
  const s = Math.floor(whole % 60);
  const cs = Math.floor((whole % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs}`;
}

export function VideoStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<ProductImage[]>([]);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const lastTsRef = useRef(0);
  const rafRef = useRef(0);

  const [images, setImages] = useState<ProductImage[]>([]);
  const [effect, setEffect] = useState<EffectId>("gentle-reveal");
  const [duration, setDuration] = useState(8);
  const [aspect, setAspect] = useState<AspectId>("1:1");
  const [fit, setFit] = useState<FitMode>("cover");
  const [zoom, setZoom] = useState(12);
  const [background, setBackground] = useState("#ffffff");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverDrop, setHoverDrop] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const size = useMemo(
    () => ASPECTS.find((item) => item.id === aspect) ?? ASPECTS[0],
    [aspect],
  );
  const zoomAmount = zoom / 100;
  const canExport = images.length >= MIN_IMAGES && images.length <= MAX_IMAGES && !exporting;

  const paint = useCallback(
    (at: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      renderFrame(ctx, imagesRef.current, {
        time: at,
        duration,
        effect,
        zoom: zoomAmount,
        fit,
        background,
        width: size.w,
        height: size.h,
      });
    },
    [background, duration, effect, fit, size.h, size.w, zoomAmount],
  );

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    paint(timeRef.current);
  }, [paint, size.h, size.w]);

  useEffect(() => {
    const tick = (ts: number) => {
      if (!playingRef.current) return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const delta = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      timeRef.current += delta;
      if (timeRef.current >= duration) {
        timeRef.current = 0;
      }
      setTime(timeRef.current);
      paint(timeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    if (playing) {
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      paint(timeRef.current);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [duration, paint, playing]);

  useEffect(() => {
    timeRef.current = 0;
    setTime(0);
    lastTsRef.current = 0;
    paint(0);
    // Restart only when the cut or photo count changes, not on zoom/fit tweaks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, duration, images.length]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const addFiles = async (fileList: FileList | File[]) => {
    setError(null);
    const incoming = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!incoming.length) {
      setError("Please choose JPG, PNG, or WebP photos.");
      return;
    }

    const room = MAX_IMAGES - imagesRef.current.length;
    if (room <= 0) {
      setError(`You can use up to ${MAX_IMAGES} photos.`);
      return;
    }

    try {
      const loaded = await Promise.all(incoming.slice(0, room).map(loadProductImage));
      const next = [...imagesRef.current, ...loaded];
      setImages(next);
      if (next.length >= MIN_IMAGES) setPlaying(true);
      if (incoming.length > room) {
        setError(`Only ${MAX_IMAGES} photos fit. Extra files were skipped.`);
      }
    } catch {
      setError("One of the photos could not be read. Try another file.");
    }
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setImages((current) => {
      const from = current.findIndex((item) => item.id === fromId);
      const to = current.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const togglePlayback = () => {
    if (images.length < 1) return;
    setPlaying((value) => !value);
  };

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    setExportProgress(0);
    setError(null);
    setPlaying(false);
    try {
      const blob = await exportVideo({
        images,
        effect,
        duration,
        zoom: zoomAmount,
        width: size.w,
        height: size.h,
        fit,
        background,
        fps: 30,
        onProgress: setExportProgress,
      });
      const ext = extensionForBlob(blob);
      downloadBlob(blob, `etsy-listing-video.${ext}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the video.");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div>
          <p className="font-display text-xl tracking-tight md:text-2xl">
            Etsy Video Generator
          </p>
          <p className="mt-0.5 text-sm text-stone">
            Photos stay in this tab. Nothing is uploaded.
          </p>
        </div>
        <p className="hidden text-right text-xs text-stone sm:block">
          Etsy listing spec
          <br />
          5–15s · 1080px · MP4 · no audio
        </p>
      </header>

      <main className="mx-auto grid max-w-[1280px] gap-8 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-paper p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone">
                Preview
              </p>
              <p className="text-xs text-stone">
                {formatTime(time)} / {duration.toFixed(1)}s · {size.w}×{size.h}
              </p>
            </div>
            <div className="flex justify-center bg-[linear-gradient(45deg,#ece4d8_25%,transparent_25%,transparent_75%,#ece4d8_75%,#ece4d8),linear-gradient(45deg,#ece4d8_25%,transparent_25%,transparent_75%,#ece4d8_75%,#ece4d8)] bg-[length:18px_18px] bg-[position:0_0,9px_9px] p-4 md:p-8">
              <button
                type="button"
                onClick={togglePlayback}
                className="relative max-w-full overflow-hidden rounded-sm bg-white shadow-[0_0_0_1px_rgba(28,23,18,0.08)]"
                style={{ aspectRatio: `${size.w} / ${size.h}`, width: "min(100%, 560px)" }}
                aria-label={playing ? "Pause preview" : "Play preview"}
              >
                <canvas ref={canvasRef} className="block h-full w-full" />
                {images.length === 0 && (
                  <span className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-stone">
                    Add 2–10 product photos to preview the listing video
                  </span>
                )}
                {images.length > 0 && !playing && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/15">
                    <span className="rounded-full bg-paper px-4 py-2 text-sm font-medium">
                      Play
                    </span>
                  </span>
                )}
              </button>
            </div>
          </div>
          <p className="text-sm text-stone">
            Click the frame to play. Export renders at full {size.w}×{size.h} in
            your browser — usually a few seconds.
          </p>
        </section>

        <aside className="flex flex-col gap-5 rounded-2xl border border-line bg-paper p-5">
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-lg">Photos</h2>
              <span className="text-xs text-stone">
                {images.length}/{MAX_IMAGES}
              </span>
            </div>
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setHoverDrop(true);
              }}
              onDragLeave={() => setHoverDrop(false)}
              onDrop={(event) => {
                event.preventDefault();
                setHoverDrop(false);
                void addFiles(event.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${
                hoverDrop
                  ? "border-ember bg-ember/5"
                  : "border-line hover:border-ink/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                multiple
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files) void addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="text-sm font-medium">Drop photos here</span>
              <span className="mt-1 text-xs text-stone">
                or click to browse · JPG, PNG, WebP
              </span>
            </label>

            {images.length > 0 && (
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {images.map((item, index) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggingId(item.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingId) reorder(draggingId, item.id);
                      setDraggingId(null);
                    }}
                    className={`group relative aspect-square overflow-hidden rounded-lg border bg-linen ${
                      draggingId === item.id ? "border-ember opacity-60" : "border-line"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded bg-ink/70 px-1.5 text-[10px] text-paper">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeImage(item.id)}
                      className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-ink text-xs text-paper group-hover:flex"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-stone">Drag thumbnails to reorder.</p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg">Motion</h2>
            <div className="grid grid-cols-2 gap-2">
              {EFFECTS.map((item) => {
                const active = effect === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEffect(item.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-ember bg-ember/10"
                        : "border-line hover:border-ink/25"
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ember">
                      {item.tag}
                    </span>
                    <span className="mt-1 block text-sm font-medium">{item.name}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-stone">
                      {item.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4">
            <div>
              <h2 className="mb-2 font-display text-lg">Length</h2>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDuration(value)}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      duration === value
                        ? "bg-ink text-paper"
                        : "border border-line hover:border-ink/30"
                    }`}
                  >
                    {value}s
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium">Frame</h2>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAspect(item.id)}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      aspect === item.id
                        ? "bg-ink text-paper"
                        : "border border-line hover:border-ink/30"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["cover", "contain"] as FitMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFit(mode)}
                    className={`rounded-full px-3 py-1.5 text-sm capitalize ${
                      fit === mode
                        ? "bg-ink text-paper"
                        : "border border-line hover:border-ink/30"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
                {BACKGROUNDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBackground(item.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      background === item.id ? "border-ink" : "border-line"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="flex items-center justify-between text-sm">
                <span className="font-medium">Scale intensity</span>
                <span className="text-stone">{zoom}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </section>

          {error && <p className="text-sm text-ember">{error}</p>}

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={!canExport}
            className="rounded-xl bg-ember px-4 py-3 text-sm font-semibold text-white transition hover:bg-ember-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-stone"
          >
            {exporting
              ? `Rendering ${Math.round(exportProgress * 100)}%`
              : images.length < MIN_IMAGES
                ? `Add at least ${MIN_IMAGES} photos`
                : "Download video"}
          </button>
        </aside>
      </main>
    </div>
  );
}
