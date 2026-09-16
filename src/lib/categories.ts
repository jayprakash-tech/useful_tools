import type { Category } from "./types";

export const CATEGORIES: Category[] = [
  {
    slug: "compression",
    name: "Compression",
    short: "Shrink file sizes for faster pages, emails and storage — with fine control over quality, dimensions and exact target sizes.",
    icon: "archive",
  },
  {
    slug: "conversion",
    name: "Conversion",
    short: "Convert between JPG, PNG, WEBP, SVG, HEIC, PDF, Base64 and more — entirely on your device.",
    icon: "swap",
  },
  {
    slug: "resize-transform",
    name: "Resize & Transform",
    short: "Resize by pixels or percentage, rotate, flip, mirror, and add rounded corners, borders or shadows.",
    icon: "expand",
  },
  {
    slug: "crop",
    name: "Crop",
    short: "Interactive cropping with aspect presets, fixed social-media sizes and a dedicated profile picture maker.",
    icon: "crop",
  },
  {
    slug: "enhancement",
    name: "Enhancement",
    short: "Brightness, contrast, saturation, blur, sharpen, duotone, vignette, vintage presets and a one-click auto enhance.",
    icon: "sparkles",
  },
  {
    slug: "watermark-text",
    name: "Watermark & Text",
    short: "Protect and decorate images with text or logo watermarks, captions, memes, badges and frames.",
    icon: "stamp",
  },
  {
    slug: "color-analysis",
    name: "Color & Analysis",
    short: "Pick colors, extract palettes, inspect dimensions and EXIF metadata, or strip metadata for privacy.",
    icon: "palette",
  },
  {
    slug: "generators",
    name: "Generators",
    short: "Create favicons, placeholders, solid and gradient images, QR codes, Open Graph banners and before/after comparisons.",
    icon: "wand",
  },
  {
    slug: "batch",
    name: "Batch Tools",
    short: "Process many images at once — resize, convert, rename, round corners or watermark whole folders, then download a ZIP.",
    icon: "layers",
  },
  {
    slug: "notebook",
    name: "Notebook & Documents",
    short: "View, render and convert Jupyter notebooks and documents — with full code, math, images and outputs preserved.",
    icon: "bookOpen",
  },
];

export const getCategory = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
