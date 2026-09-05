/* Client-side image processing engine — everything runs in the browser via Canvas. */

export const MAX_DIM = 4096; // guard against browser-crashing canvases

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function percentSaved(original: number, next: number): string {
  if (original <= 0) return "0%";
  return `${(((original - next) / original) * 100).toFixed(1)}%`;
}

export function replaceExt(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${ext}`;
}

/* ---------------- loading ---------------- */

export function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth) reject(new Error("This file could not be decoded as an image."));
      else resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unsupported or corrupted image file."));
    };
    img.src = url;
  });
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file."));
    r.readAsDataURL(file);
  });
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** High-quality draw; steps down gradually when shrinking a lot. */
export function scaleImage(img: CanvasImageSource, sw: number, sh: number, tw: number, th: number): HTMLCanvasElement {
  tw = clamp(Math.round(tw), 1, MAX_DIM * 2);
  th = clamp(Math.round(th), 1, MAX_DIM * 2);
  let cur: CanvasImageSource = img;
  let cw = sw;
  let ch = sh;
  while (cw / 2 > tw && ch / 2 > th) {
    const mid = makeCanvas(cw / 2, ch / 2);
    const ctx = mid.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, mid.width, mid.height);
    cur = mid;
    cw = mid.width;
    ch = mid.height;
  }
  const out = makeCanvas(tw, th);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, tw, th);
  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Your browser could not encode this format."))),
      type,
      quality,
    );
  });
}

export const blobUrl = (b: Blob) => URL.createObjectURL(b);

/* ---------------- download / clipboard / zip ---------------- */

export function downloadBlob(filename: string, blob: Blob) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export async function makeZip(files: { name: string; data: Blob | string }[], ): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const f of files) {
    let name = f.name;
    let i = 1;
    while (used.has(name)) {
      const dot = f.name.lastIndexOf(".");
      name = dot > 0 ? `${f.name.slice(0, dot)}-${i}${f.name.slice(dot)}` : `${f.name}-${i}`;
      i++;
    }
    used.add(name);
    zip.file(name, f.data);
  }
  return zip.generateAsync({ type: "blob" });
}

/* ---------------- canvas effects ---------------- */

export function applyCssFilter(img: HTMLImageElement, filter: string, w?: number, h?: number): HTMLCanvasElement {
  const c = makeCanvas(w ?? img.naturalWidth, h ?? img.naturalHeight);
  const ctx = c.getContext("2d")!;
  ctx.filter = filter;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.filter = "none";
  return c;
}

export function transformPixels(canvas: HTMLCanvasElement, fn: (d: Uint8ClampedArray) => void): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  fn(data.data);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");

export interface PaletteColor { hex: string; pct: number; }

/** Simple histogram quantization → dominant palette with share of image. */
export function quantizePalette(canvas: HTMLCanvasElement, count: number): PaletteColor[] {
  const small = scaleImage(canvas, canvas.width, canvas.height, 96, Math.max(1, Math.round((96 * canvas.height) / canvas.width)));
  const ctx = small.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, small.width, small.height);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let totalPx = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    totalPx++;
    const r = data[i] & 0xe0, g = data[i + 1] & 0xe0, b = data[i + 2] & 0xe0;
    const key = (r << 16) | (g << 8) | b;
    const e = buckets.get(key);
    if (e) { e.n++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2]; }
    else buckets.set(key, { n: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const picked: { c: [number, number, number]; n: number }[] = [];
  for (const e of sorted) {
    const c: [number, number, number] = [e.r / e.n, e.g / e.n, e.b / e.n];
    const tooClose = picked.some(
      (p) => Math.abs(p.c[0] - c[0]) + Math.abs(p.c[1] - c[1]) + Math.abs(p.c[2] - c[2]) < 90,
    );
    if (!tooClose) picked.push({ c, n: e.n });
    if (picked.length >= count) break;
  }
  const pickedTotal = picked.reduce((a, p) => a + p.n, 0) || 1;
  return picked.map((p) => ({ hex: rgbToHex(p.c[0], p.c[1], p.c[2]), pct: (p.n / pickedTotal) * 100 }));
}

/** Histogram-stretch based auto enhancement (plain math, not AI). */
export function autoEnhance(img: HTMLImageElement, mode: "normal" | "vivid" | "bright" | "warm" | "cool"): string {
  const small = scaleImage(img, img.naturalWidth, img.naturalHeight, 120, Math.max(1, Math.round((120 * img.naturalHeight) / img.naturalWidth)));
  const { data } = small.getContext("2d")!.getImageData(0, 0, small.width, small.height);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) hist[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++;
  const total = hist.reduce((a: number, b: number) => a + b, 0) || 1;
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.02) { hi = i; break; } }
  const contrast = clamp(128 / Math.max(1, (hi - lo) / 2), 1, 1.5);
  const brightness = clamp(1 + (128 - (lo + hi) / 2) / 400, 0.9, 1.15);
  let sat = mode === "vivid" ? 1.35 : mode === "normal" ? 1.12 : 1.05;
  if (mode === "bright") return `brightness(${(brightness * 1.1).toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${sat})`;
  let filter = `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${sat})`;
  if (mode === "warm") filter += " sepia(0.16) saturate(1.2)";
  if (mode === "cool") filter += " hue-rotate(12deg) saturate(1.12)";
  return filter;
}

export function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ---------------- SVG ---------------- */

export function sanitizeSvg(svgText: string): string {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("This does not look like a valid SVG file.");
  doc.querySelectorAll("script, iframe, object, embed, audio, video").forEach((n) => n.remove());
  const all = doc.querySelectorAll("*");
  all.forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const n = attr.name.toLowerCase();
      if (n.startsWith("on") || (/(href|xlink:href|src)$/.test(n) && attr.value.trim().toLowerCase().startsWith("javascript:"))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export function svgDimensions(svgText: string): { w: number; h: number } {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  let w = parseFloat(svg?.getAttribute("width") ?? "") || 0;
  let h = parseFloat(svg?.getAttribute("height") ?? "") || 0;
  if ((!w || !h) && svg?.getAttribute("viewBox")) {
    const [, , vw, vh] = svg.getAttribute("viewBox")!.trim().split(/[\s,]+/).map(Number);
    w = w || vw || 512;
    h = h || vh || 512;
  }
  return { w: w || 512, h: h || 512 };
}

export async function rasterizeSvg(svgText: string, scale: number, bg?: string): Promise<HTMLCanvasElement> {
  const clean = sanitizeSvg(svgText);
  const { w, h } = svgDimensions(clean);
  const blob = new Blob([clean], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("The SVG could not be rendered by your browser."));
      i.src = url;
    });
    const c = makeCanvas(clamp(w * scale, 1, MAX_DIM), clamp(h * scale, 1, MAX_DIM));
    const ctx = c.getContext("2d")!;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------------- misc ---------------- */

let uid = 0;
export const nextId = () => `${Date.now().toString(36)}-${(uid++).toString(36)}`;

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}
