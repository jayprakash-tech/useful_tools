import { useCallback, useRef, useState } from "react";
import type { ReactNode, DragEvent } from "react";
import {
  Gauge, Archive, Sliders, Target, Minimize2, ArrowLeftRight, FileImage, Zap, Code, Camera, Braces,
  FileText, Link2, Expand, Percent, RectangleHorizontal, RotateCw, FlipHorizontal, Columns, Square, Frame,
  Layers, Sun, Contrast, Droplet, Aperture, Moon, Circle, Film, RefreshCw, Eye, Focus, Wand2, Thermometer,
  Type, ImagePlus, PenTool, Smile, BadgeCheck, Share2, Pipette, Palette, List, Info, Eraser, Calculator,
  Printer, Star, LayoutTemplate, Sunrise, QrCode, Monitor, Tag, Stamp, Crop, User, Upload, Download,
  Image as ImageIcon, FolderDown, ArrowRight, ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tool } from "../lib/types";
import { CATEGORIES, getCategory } from "../lib/categories";
import { toolsByCategory, getTool } from "../lib/tools";
import { formatBytes } from "../lib/image";
import { Alert, Badge, Button, Card, cx } from "./ui";

export const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge, archive: Archive, sliders: Sliders, target: Target, minimize: Minimize2, swap: ArrowLeftRight,
  fileImage: FileImage, zap: Zap, code: Code, camera: Camera, braces: Braces, fileText: FileText, link: Link2,
  expand: Expand, percent: Percent, rectangle: RectangleHorizontal, rotate: RotateCw, flipH: FlipHorizontal,
  columns: Columns, square: Square, frame: Frame, layers: Layers, sun: Sun, contrast: Contrast, droplet: Droplet,
  aperture: Aperture, moon: Moon, circle: Circle, film: Film, refresh: RefreshCw, eye: Eye, focus: Focus,
  wand: Wand2, thermometer: Thermometer, type: Type, imagePlus: ImagePlus, pen: PenTool, smile: Smile,
  badge: BadgeCheck, share: Share2, pipette: Pipette, palette: Palette, list: List, info: Info, eraser: Eraser,
  calculator: Calculator, printer: Printer, star: Star, layout: LayoutTemplate, sunrise: Sunrise, qr: QrCode,
  monitor: Monitor, tag: Tag, stamp: Stamp, crop: Crop, user: User,
};

export const toolIcon = (key: string): LucideIcon => ICONS[key] ?? ImageIcon;

/* ---------------- FileDropzone ---------------- */

export function FileDropzone({
  accept = "image/*",
  multiple = false,
  onFiles,
  title,
  subtitle,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  subtitle?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const acceptList = accept.split(",").map((a) => a.trim().toLowerCase());
  const matches = (f: File) =>
    acceptList.some((a) =>
      a.endsWith("/*") ? f.type.toLowerCase().startsWith(a.slice(0, -1)) : f.type.toLowerCase() === a || f.name.toLowerCase().endsWith(a.replace(/^\./, ".")),
    );

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setError(null);
      setWarn(null);
      const files = [...list];
      const bad = files.filter((f) => !matches(f));
      if (bad.length === files.length) {
        setError(`Unsupported file type${files.length > 1 ? "s" : ""}. Accepted: ${accept.replace(/image\//g, "").replace(/\./g, "").toUpperCase()}`);
        return;
      }
      const huge = files.filter((f) => f.size > 40 * 1024 * 1024);
      if (huge.length) setWarn("Very large files can slow your browser. Images under 25 MB work best.");
      onFiles(multiple ? files.filter((f) => !bad.includes(f)) : files.filter((f) => !bad.includes(f)).slice(0, 1));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accept, multiple, onFiles],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handle(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cx(
          "focus-ring group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
          drag
            ? "scale-[1.01] border-brand-500 bg-brand-50 dark:bg-brand-950/40"
            : "border-ink-300 bg-white hover:border-brand-400 hover:bg-brand-50/50 dark:border-ink-600 dark:bg-ink-900 dark:hover:border-brand-500 dark:hover:bg-ink-800/60",
        )}
      >
        <span className={cx("rounded-full p-3.5 transition-all duration-200", drag ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700 group-hover:scale-110 dark:bg-brand-900/70 dark:text-brand-300")}>
          <Upload size={22} aria-hidden />
        </span>
        <span className="font-display text-[15px] font-bold text-ink-800 dark:text-ink-100">
          {title ?? (multiple ? "Drop images here" : "Drop an image here")}
        </span>
        <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
          {subtitle ?? "or"}{" "}
          <span className="font-bold text-brand-600 underline decoration-brand-300 underline-offset-2 dark:text-brand-400">browse files</span>
          {" · "}
          {accept.replace(/image\//g, "").replace(/\./g, "").replace(/,/g, " / ").toUpperCase() || "any image"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
        />
      </button>
      {error && <Alert tone="error">{error}</Alert>}
      {warn && <Alert tone="warn">{warn}</Alert>}
    </div>
  );
}

/* ---------------- previews ---------------- */

export function ImagePreview({
  src, label, width, height, bytes, className, checker = true,
}: {
  src: string; label: string; width?: number; height?: number; bytes?: number; className?: string; checker?: boolean;
}) {
  return (
    <figure className={cx("overflow-hidden rounded-xl border border-ink-200/70 dark:border-ink-700/60", className)}>
      <div className={cx("flex max-h-[420px] items-center justify-center overflow-hidden p-2", checker && "checker")}>
        <img src={src} alt={`${label} preview`} className="max-h-[400px] max-w-full rounded object-contain shadow-sm transition-transform duration-300 hover:scale-[1.02]" />
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-200/70 bg-ink-50 px-3.5 py-2 text-xs font-semibold text-ink-500 dark:border-ink-700/60 dark:bg-ink-800/60 dark:text-ink-400">
        <span className="font-bold text-ink-700 dark:text-ink-200">{label}</span>
        {width && height ? <span>{width} × {height} px</span> : null}
        {bytes !== undefined ? <span>{formatBytes(bytes)}</span> : null}
      </figcaption>
    </figure>
  );
}

export function DownloadButton({
  blob, url, filename, label = "Download", onDone, disabled,
}: {
  blob?: Blob | null; url?: string | null; filename: string; label?: string; onDone?: () => void; disabled?: boolean;
}) {
  return (
    <Button
      disabled={disabled || (!blob && !url)}
      onClick={() => {
        if (blob) {
          const a = document.createElement("a");
          const u = URL.createObjectURL(blob);
          a.href = u;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(u), 4000);
        } else if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
        }
        onDone?.();
      }}
      className="w-full"
    >
      <Download size={16} aria-hidden /> {label}
    </Button>
  );
}

/* ---------------- cards ---------------- */

export function ToolCard({ tool, delay = 0 }: { tool: Tool; delay?: number }) {
  const Icon = toolIcon(tool.icon);
  const cat = getCategory(tool.cat);
  return (
    <a
      href={`#/tools/${tool.slug}`}
      className="focus-ring group flex h-full flex-col rounded-xl border border-ink-200/70 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift dark:border-ink-700/60 dark:bg-ink-900 dark:hover:border-brand-700"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg bg-brand-100 p-2.5 text-brand-700 transition-transform duration-200 group-hover:scale-110 dark:bg-brand-900/70 dark:text-brand-300">
          <Icon size={19} aria-hidden />
        </span>
        {tool.popular && <Badge>Popular</Badge>}
      </div>
      <h3 className="mt-3.5 font-display text-[15px] font-bold text-ink-900 transition-colors group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-400">
        {tool.name}
      </h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">{tool.short}</p>
      <div className="mt-4 flex items-center justify-between">
        {cat && <Badge tone="neutral">{cat.name}</Badge>}
        <ArrowRight size={15} className="text-ink-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-brand-600 dark:text-ink-600" aria-hidden />
      </div>
    </a>
  );
}

export function CategoryCard({ slug }: { slug: string }) {
  const cat = CATEGORIES.find((c) => c.slug === slug)!;
  const Icon = toolIcon(cat.icon);
  const count = toolsByCategory(cat.slug).length;
  return (
    <a
      href={`#/categories/${cat.slug}`}
      className="focus-ring group flex items-start gap-4 rounded-xl border border-ink-200/70 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift dark:border-ink-700/60 dark:bg-ink-900 dark:hover:border-brand-700"
    >
      <span className="rounded-lg bg-brand-100 p-3 text-brand-700 transition-transform group-hover:scale-110 dark:bg-brand-900/70 dark:text-brand-300">
        <Icon size={21} aria-hidden />
      </span>
      <span>
        <span className="flex items-center gap-2 font-display text-[15px] font-bold text-ink-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-400">
          {cat.name}
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">{count}</span>
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">{cat.short}</span>
      </span>
    </a>
  );
}



/* ---------------- ads ---------------- */

/**
 * AdSlot — AdSense-ready placeholder.
 * When VITE_ADSENSE_CLIENT is configured (see .env.example), replace the
 * placeholder block below with a real <ins class="adsbygoogle"> unit:
 *
 *   <ins className="adsbygoogle" style={{display:"block"}}
 *        data-ad-client={AD_CLIENT} data-ad-slot="YOUR_SLOT_ID"
 *        data-ad-format="auto" data-full-width-responsive="true" />
 *   then push to (window.adsbygoogle = window.adsbygoogle || []).
 *
 * Slots are intentionally placed OUTSIDE the interactive tool controls:
 * top of page, sidebar (desktop) and bottom of page.
 */
export function AdSlot({ variant = "top", className }: { variant?: "top" | "sidebar" | "bottom" | "in-article"; className?: string }) {
  const client = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? "";
  const heights = { top: "h-24", sidebar: "h-64", bottom: "h-28", "in-article": "h-32" };
  if (client) {
    // Real AdSense units render here after approval — see comment above.
    return (
      <div className={cx("flex items-center justify-center overflow-hidden rounded-xl border border-ink-200/60 bg-white dark:border-ink-700/50 dark:bg-ink-900", heights[variant], className)} data-ad-variant={variant}>
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-300 dark:text-ink-600">AdSense unit · {variant}</span>
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cx("flex items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/60 dark:border-ink-700/60 dark:bg-ink-900/40", heights[variant], className)}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-300 dark:text-ink-600">Advertisement</span>
    </div>
  );
}

/* ---------------- SEO content block ---------------- */

export function SeoContentBlock({ tool }: { tool: Tool }) {
  return (
    <div className="space-y-10">
      <section aria-labelledby="how-to-use">
        <h2 id="how-to-use" className="font-display text-xl font-bold text-ink-900 dark:text-white">How to use the {tool.name}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {tool.steps.map((s, i) => (
            <li key={s} className="flex gap-3 rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-700/60 dark:bg-ink-900">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">{i + 1}</span>
              <span className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="benefits">
          <h2 id="benefits" className="font-display text-xl font-bold text-ink-900 dark:text-white">Why use it</h2>
          <ul className="mt-4 space-y-3">
            {tool.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-ink-300">
                <span className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M1.5 5.5 4 8l4.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                {b}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="formats">
          <h2 id="formats" className="font-display text-xl font-bold text-ink-900 dark:text-white">Supported formats</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {tool.formats.map((f) => (
              <span key={f} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">
                {f}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <p className="text-[13px] leading-relaxed text-emerald-900 dark:text-emerald-200">
              <strong>Private by design.</strong> Your images are processed locally in your browser and are not uploaded to our servers. Close the tab and nothing remains.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export function RelatedTools({ slugs }: { slugs: string[] }) {
  const tools = slugs.map((s) => getTool(s)).filter((x): x is Tool => Boolean(x));
  if (!tools.length) return null;
  return (
    <section aria-labelledby="related-tools">
      <h2 id="related-tools" className="font-display text-xl font-bold text-ink-900 dark:text-white">Related tools</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t, i) => <ToolCard key={t.slug} tool={t} delay={i * 60} />)}
      </div>
    </section>
  );
}

/* ---------------- misc ---------------- */

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "ok" | "brand" }) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white px-4 py-3 dark:border-ink-700/60 dark:bg-ink-900">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={cx("mt-0.5 font-display text-lg font-bold tabular-nums", tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-ink-900 dark:text-white")}>
        {value}
      </p>
    </div>
  );
}

export { Card, Button, Badge, cx, FolderDown };
