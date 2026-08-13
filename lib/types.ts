export type EffectId =
  | "gentle-reveal"
  | "gallery-glide"
  | "rapid-showcase"
  | "scale-in";

export type AspectId = "1:1" | "16:9" | "9:16";
export type FitMode = "cover" | "contain";

export type DrawOp = {
  imageIndex: number;
  destX: number;
  destY: number;
  destW: number;
  destH: number;
  scale: number;
  opacity: number;
};

export type ProductImage = {
  id: string;
  file: File;
  url: string;
  image: HTMLImageElement;
};

export const EFFECTS: {
  id: EffectId;
  name: string;
  tag: string;
  blurb: string;
}[] = [
  {
    id: "gentle-reveal",
    name: "Gentle Reveal",
    tag: "Scale",
    blurb: "Slow Ken Burns zoom with a soft crossfade — Alura’s classic look.",
  },
  {
    id: "scale-in",
    name: "Scale In",
    tag: "Stack",
    blurb: "Each photo grows from the center, then the next one lands on top.",
  },
  {
    id: "gallery-glide",
    name: "Gallery Glide",
    tag: "Pan",
    blurb: "A continuous sideways glide through every photo, full-bleed.",
  },
  {
    id: "rapid-showcase",
    name: "Rapid Showcase",
    tag: "Cut",
    blurb: "Punchy scale-in cuts so shoppers see every angle fast.",
  },
];

export const ASPECTS: { id: AspectId; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "1:1 Etsy", w: 1080, h: 1080 },
  { id: "16:9", label: "16:9", w: 1920, h: 1080 },
  { id: "9:16", label: "9:16", w: 1080, h: 1920 },
];

export const DURATIONS = [5, 8, 12, 15] as const;

export const BACKGROUNDS = [
  { id: "#ffffff", label: "White" },
  { id: "#f4efe8", label: "Linen" },
  { id: "#111111", label: "Ink" },
] as const;
