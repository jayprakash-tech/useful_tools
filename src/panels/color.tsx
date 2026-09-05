import { useMemo, useRef, useState } from "react";
import type { Tool } from "../lib/types";
import {
  canvasToBlob, formatBytes, gcd, makeCanvas, quantizePalette, replaceExt, rgbToHex, scaleImage,
} from "../lib/image";
import { useImageInput, useOutput, ControlsCard, ToolGrid, ActionRow, errMsg } from "./state";
import { FileDropzone, ImagePreview, DownloadButton, Stat } from "../components/shared";
import { Alert, Button, CopyButton, Field, Select, SliderControl, TextInput, useToast } from "../components/ui";

/* ---------------- Color picker ---------------- */

export function ColorPickerPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [picked, setPicked] = useState<{ hex: string; rgb: [number, number, number]; patch: string } | null>(null);
  const [hover, setHover] = useState<{ hex: string; x: number; y: number } | null>(null);

  const ensureCanvas = (img: HTMLImageElement) => {
    if (canvasRef.current) return canvasRef.current;
    const c = makeCanvas(img.naturalWidth, img.naturalHeight);
    c.getContext("2d")!.drawImage(img, 0, 0);
    canvasRef.current = c;
    return c;
  };

  const sample = (img: HTMLImageElement, clientX: number, clientY: number, el: HTMLElement, commit: boolean) => {
    const rect = el.getBoundingClientRect();
    const x = Math.min(img.naturalWidth - 1, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * img.naturalWidth)));
    const y = Math.min(img.naturalHeight - 1, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * img.naturalHeight)));
    const c = ensureCanvas(img);
    const d = c.getContext("2d")!.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(d[0], d[1], d[2]);
    setHover({ hex, x, y });
    if (commit) {
      const patchC = makeCanvas(132, 132);
      const pctx = patchC.getContext("2d")!;
      pctx.imageSmoothingEnabled = false;
      const sx = Math.max(0, x - 5), sy = Math.max(0, y - 5);
      pctx.drawImage(c, sx, sy, 11, 11, 0, 0, 132, 132);
      pctx.strokeStyle = "#fff";
      pctx.lineWidth = 4;
      const cell = 132 / 11;
      pctx.strokeRect((x - sx) * cell, (y - sy) * cell, cell, cell);
      setPicked({ hex, rgb: [d[0], d[1], d[2]], patch: patchC.toDataURL() });
    }
  };

  return (
    <div className="space-y-6">
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => { canvasRef.current = null; setPicked(null); setHover(null); input.load(f[0]); }} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div
            className="checker cursor-crosshair overflow-hidden rounded-xl border border-ink-200/70 dark:border-ink-700/60"
            onPointerMove={(e) => sample(input.img!, e.clientX, e.clientY, e.currentTarget, false)}
            onClick={(e) => sample(input.img!, e.clientX, e.clientY, e.currentTarget, true)}
            role="img"
            aria-label="Image — click a pixel to sample its color"
          >
            <img src={input.url} alt="Pick a color from this image" className="mx-auto max-h-[460px] select-none object-contain" draggable={false} />
          </div>
          <div className="space-y-4">
            {picked ? (
              <div className="rounded-xl border border-ink-200/70 bg-white p-4 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
                <div className="flex items-center gap-3">
                  <span className="h-14 w-14 shrink-0 rounded-lg border border-ink-200 shadow-inner dark:border-ink-600" style={{ background: picked.hex }} aria-hidden />
                  <img src={picked.patch} alt="Zoomed pixels around selection" className="h-14 w-14 rounded-lg border border-ink-200 dark:border-ink-600" style={{ imageRendering: "pixelated" }} />
                </div>
                <dl className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-xs font-bold uppercase text-ink-400">HEX</dt>
                    <dd className="flex items-center gap-2 font-mono text-sm font-bold text-ink-800 dark:text-ink-100">
                      {picked.hex.toUpperCase()} <CopyButton text={picked.hex.toUpperCase()} label="" />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-xs font-bold uppercase text-ink-400">RGB</dt>
                    <dd className="flex items-center gap-2 font-mono text-sm font-bold text-ink-800 dark:text-ink-100">
                      {picked.rgb.join(", ")} <CopyButton text={`rgb(${picked.rgb.join(", ")})`} label="" />
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-ink-200 p-5 text-sm font-semibold text-ink-400 dark:border-ink-700">
                Click any pixel to read its exact color.
              </div>
            )}
            {hover && (
              <p className="flex items-center gap-2 text-xs font-bold text-ink-500">
                <span className="h-4 w-4 rounded border border-ink-200 dark:border-ink-600" style={{ background: hover.hex }} aria-hidden />
                {hover.hex.toUpperCase()} at {hover.x}, {hover.y}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Palettes ---------------- */

function PaletteView({ colors, big }: { colors: { hex: string; pct: number }[]; big?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex h-16 overflow-hidden rounded-xl border border-ink-200/70 shadow-soft dark:border-ink-700/60">
        {colors.map((c) => (
          <div key={c.hex} className="group relative flex-1 transition-all duration-200 hover:flex-[1.6]" style={{ background: c.hex }} title={`${c.hex} · ${c.pct.toFixed(0)}%`}>
            <span className="absolute inset-x-0 bottom-1 text-center font-mono text-[9px] font-bold text-white opacity-0 mix-blend-difference transition-opacity group-hover:opacity-100">
              {c.hex.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {colors.map((c) => (
          <li key={c.hex} className="flex items-center gap-2.5 rounded-lg border border-ink-200/70 bg-white px-2.5 py-2 dark:border-ink-700/60 dark:bg-ink-900">
            <span className="h-7 w-7 shrink-0 rounded-md border border-ink-200 dark:border-ink-600" style={{ background: c.hex }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-xs font-bold text-ink-800 dark:text-ink-100">{c.hex.toUpperCase()}</span>
              {big && <span className="block text-[10px] font-bold text-ink-400">{c.pct.toFixed(1)}% of image</span>}
            </span>
            <CopyButton text={c.hex.toUpperCase()} label="" />
          </li>
        ))}
      </ul>
      <CopyButton text={colors.map((c) => c.hex.toUpperCase()).join(", ")} label="Copy all colors" />
    </div>
  );
}

export function DominantPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const [colors, setColors] = useState<{ hex: string; pct: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const extract = async () => {
    if (!input.img) return;
    setBusy(true); setErr(null);
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      c.getContext("2d")!.drawImage(input.img, 0, 0);
      setColors(quantizePalette(c, 6));
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => { setColors(null); input.load(f[0]); }} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="space-y-5">
          <ImagePreview src={input.url} label="Source image" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {!colors ? (
            <Button onClick={extract} busy={busy}>Extract dominant colors</Button>
          ) : (
            <PaletteView colors={colors} big />
          )}
        </div>
      )}
    </div>
  );
}

export function PalettePanel({ tool }: { tool: Tool }) {
  const counts: number[] = tool.config?.counts ?? [5, 10, 15];
  const input = useImageInput();
  const [count, setCount] = useState(counts[1] ?? counts[0]);
  const [colors, setColors] = useState<{ hex: string; pct: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const extract = async (n: number) => {
    if (!input.img) return;
    setBusy(true); setErr(null);
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      c.getContext("2d")!.drawImage(input.img, 0, 0);
      setColors(quantizePalette(c, n));
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Palette size">
          <div className="grid grid-cols-3 gap-2">
            {counts.map((n) => (
              <button key={n} onClick={() => { setCount(n); if (input.img) extract(n); }} className={`focus-ring rounded-lg border px-3 py-2.5 font-display text-sm font-bold transition-colors ${count === n ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300"}`}>
                {n} colors
              </button>
            ))}
          </div>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={() => extract(count)} onReset={() => { input.reset(); setColors(null); setErr(null); }} processLabel={`Extract ${count} colors`} />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => { setColors(null); input.load(f[0]); }} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="space-y-5">
          <ImagePreview src={input.url} label="Source image" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {colors && <PaletteView colors={colors} />}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Image info ---------------- */

export function InfoPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const meta = useMemo(() => {
    if (!input.img || !input.file) return null;
    const w = input.img.naturalWidth, h = input.img.naturalHeight;
    const g = gcd(w, h);
    return { w, h, ratio: `${w / g}:${h / g}`, decimal: (w / h).toFixed(3), mp: ((w * h) / 1e6).toFixed(2) };
  }, [input.img, input.file]);

  return (
    <div className="space-y-5">
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} title="Drop an image to inspect" />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {input.url && input.img && meta && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Inspected image" width={meta.w} height={meta.h} bytes={input.file!.size} />
          <div className="grid grid-cols-2 content-start gap-3">
            <Stat label="File name" value={<span className="break-all text-sm">{input.file!.name}</span>} />
            <Stat label="MIME type" value={input.file!.type || "unknown"} />
            <Stat label="File size" value={formatBytes(input.file!.size)} />
            <Stat label="Last modified" value={new Date(input.file!.lastModified).toLocaleDateString()} />
            <Stat label="Dimensions" value={`${meta.w} × ${meta.h} px`} />
            <Stat label="Megapixels" value={`${meta.mp} MP`} />
            <Stat label="Aspect ratio" value={`${meta.ratio} (${meta.decimal})`} tone="ok" />
            <Stat label="Orientation" value={meta.w > meta.h ? "Landscape" : meta.w < meta.h ? "Portrait" : "Square"} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- EXIF viewer ---------------- */

export function ExifViewPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const [rows, setRows] = useState<[string, string][] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parse = async () => {
    if (!input.file) return;
    setBusy(true); setErr(null); setRows(null);
    try {
      const exifr = (await import("exifr")).default;
      const data = await exifr.parse(input.file);
      if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
        setRows([]);
        return;
      }
      const clean: [string, string][] = Object.entries(data)
        .filter(([k, v]) => v !== undefined && v !== null && typeof v !== "object" || v instanceof Date)
        .map(([k, v]) => [k, v instanceof Date ? v.toLocaleString() : String(v)] as [string, string])
        .slice(0, 40);
      setRows(clean);
    } catch {
      setRows([]);
    } finally { setBusy(false); }
  };

  const priority = ["Make", "Model", "LensModel", "DateTimeOriginal", "ExposureTime", "FNumber", "ISO", "FocalLength", "GPSLatitude", "GPSLongitude", "Software", "Orientation"];

  return (
    <div className="space-y-5">
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => { setRows(null); input.load(f[0]); }} title="Drop a photo to read its EXIF" />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Photo" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          <div className="space-y-4">
            {!rows ? (
              <Button onClick={parse} busy={busy}>Read EXIF metadata</Button>
            ) : rows.length === 0 ? (
              <Alert tone="info">
                No EXIF metadata found in this file. Screenshots, edited exports and images sent through messaging apps usually have it stripped.
              </Alert>
            ) : (
              <div className="overflow-hidden rounded-xl border border-ink-200/70 bg-white dark:border-ink-700/60 dark:bg-ink-900">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-ink-200/70 bg-ink-50 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-700/60 dark:bg-ink-800">
                      <th className="px-3.5 py-2 font-bold">Tag</th>
                      <th className="px-3.5 py-2 font-bold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {[...rows].sort((a, b) => priority.indexOf(a[0]) - priority.indexOf(b[0])).map(([k, v]) => (
                      <tr key={k}>
                        <td className="px-3.5 py-1.5 font-mono text-xs font-bold text-brand-700 dark:text-brand-300">{k}</td>
                        <td className="max-w-[220px] truncate px-3.5 py-1.5 font-medium text-ink-700 dark:text-ink-200" title={v}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- EXIF remover ---------------- */

export function ExifRemovePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [format, setFormat] = useState("image/jpeg");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      const ctx = c.getContext("2d")!;
      if (format === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(input.img, 0, 0);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : quality / 100);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Clean re-encode">
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          {format !== "image/png" && <SliderControl label="Quality" value={quality} min={50} max={100} unit="%" defaultValue={92} onChange={setQuality} />}
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-relaxed text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Re-encoding through Canvas creates a brand-new file: GPS, camera tags and embedded thumbnails are all left behind.
          </p>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Strip metadata" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} title="Drop a photo to clean" />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original (may contain EXIF)" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Clean copy" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png")} label="Download clean image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Clean copy appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Aspect ratio calculator ---------------- */

export function AspectCalcPanel({ tool }: { tool: Tool }) {
  const toast = useToast();
  const [w, setW] = useState("1920");
  const [h, setH] = useState("1080");
  const [rw, setRw] = useState("16");
  const [rh, setRh] = useState("9");
  const [known, setKnown] = useState("1280");

  const wi = parseInt(w, 10), hi = parseInt(h, 10);
  const ratio = wi > 0 && hi > 0 ? (() => { const g = gcd(wi, hi); return { frac: `${wi / g}:${hi / g}`, dec: (wi / hi).toFixed(3) }; })() : null;

  const rwi = Math.max(1, parseInt(rw, 10) || 1), rhi = Math.max(1, parseInt(rh, 10) || 1);
  const ki = parseInt(known, 10) || 0;
  const solvedH = Math.round((ki * rhi) / rwi);
  const solvedW = Math.round((ki * rwi) / rhi);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
        <h2 className="font-display text-[15px] font-bold text-ink-900 dark:text-white">Dimensions → ratio</h2>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width (px)"><TextInput inputMode="numeric" value={w} onChange={(e) => setW(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Height (px)"><TextInput inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          {ratio && (
            <div className="rounded-xl bg-brand-600 px-4 py-3.5 text-white">
              <p className="font-display text-2xl font-bold">{ratio.frac}</p>
              <p className="mt-0.5 flex items-center justify-between text-xs font-semibold text-white/80">
                decimal {ratio.dec}
                <CopyButton text={ratio.frac} label="Copy" className="bg-white/15 text-white hover:bg-white/25" />
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
        <h2 className="font-display text-[15px] font-bold text-ink-900 dark:text-white">Ratio → missing side</h2>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Ratio W"><TextInput inputMode="numeric" value={rw} onChange={(e) => setRw(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Ratio H"><TextInput inputMode="numeric" value={rh} onChange={(e) => setRh(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Known width"><TextInput inputMode="numeric" value={known} onChange={(e) => setKnown(e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-ink-50 px-4 py-3 dark:bg-ink-800">
              <p className="text-[11px] font-bold uppercase text-ink-400">Height for width {ki}</p>
              <p className="mt-0.5 flex items-center justify-between font-display text-xl font-bold text-ink-900 dark:text-white">
                {solvedH} px
                <CopyButton text={String(solvedH)} label="" />
              </p>
            </div>
            <div className="rounded-xl bg-ink-50 px-4 py-3 dark:bg-ink-800">
              <p className="text-[11px] font-bold uppercase text-ink-400">Width for height {ki}</p>
              <p className="mt-0.5 flex items-center justify-between font-display text-xl font-bold text-ink-900 dark:text-white">
                {solvedW} px
                <CopyButton text={String(solvedW)} label="" />
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["1:1", "4:3", "16:9", "9:16", "3:2", "21:9"].map((r) => (
              <button key={r} onClick={() => { const [a, b] = r.split(":"); setRw(a); setRh(b); toast(`Ratio set to ${r}`, "info"); }} className="focus-ring rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-ink-600 hover:border-brand-400 hover:text-brand-700 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300">
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Print size calculator ---------------- */

export function PrintCalcPanel({ tool }: { tool: Tool }) {
  const [pw, setPw] = useState("3000");
  const [ph, setPh] = useState("2000");
  const [dpi, setDpi] = useState("300");
  const [inches, setInches] = useState("8");

  const w = parseInt(pw, 10) || 0, h = parseInt(ph, 10) || 0, d = parseInt(dpi, 10) || 300;
  const inW = w / d, inH = h / d;
  const backPx = Math.round(parseFloat(inches || "0") * d);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
        <h2 className="font-display text-[15px] font-bold text-ink-900 dark:text-white">Pixels → print size</h2>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Width px"><TextInput inputMode="numeric" value={pw} onChange={(e) => setPw(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Height px"><TextInput inputMode="numeric" value={ph} onChange={(e) => setPh(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="DPI">
              <Select value={String(dpi)} onChange={(e) => setDpi(e.target.value)}>
                <option value="72">72 (banner)</option>
                <option value="150">150 (poster)</option>
                <option value="300">300 (photo)</option>
                <option value="600">600 (fine art)</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-brand-600 px-4 py-3.5 text-white">
              <p className="text-[11px] font-bold uppercase text-white/70">Inches</p>
              <p className="font-display text-xl font-bold">{inW.toFixed(2)}″ × {inH.toFixed(2)}″</p>
            </div>
            <div className="rounded-xl bg-ink-900 px-4 py-3.5 text-white dark:bg-ink-800">
              <p className="text-[11px] font-bold uppercase text-white/60">Centimeters</p>
              <p className="font-display text-xl font-bold">{(inW * 2.54).toFixed(1)} × {(inH * 2.54).toFixed(1)} cm</p>
            </div>
          </div>
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-semibold leading-relaxed text-ink-500 dark:bg-ink-800">
            {d >= 300 ? "Sharp for handheld viewing." : d >= 150 ? "Good for posters viewed from a distance." : "Only suitable for large-format viewed from meters away."}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
        <h2 className="font-display text-[15px] font-bold text-ink-900 dark:text-white">Print size → pixels needed</h2>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desired width (inches)"><TextInput inputMode="decimal" value={inches} onChange={(e) => setInches(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
            <Field label="DPI">
              <Select value={String(dpi)} onChange={(e) => setDpi(e.target.value)}>
                <option value="72">72</option><option value="150">150</option><option value="300">300</option><option value="600">600</option>
              </Select>
            </Field>
          </div>
          <div className="rounded-xl bg-brand-600 px-4 py-3.5 text-white">
            <p className="text-[11px] font-bold uppercase text-white/70">Required width</p>
            <p className="flex items-center justify-between font-display text-2xl font-bold">
              {backPx.toLocaleString()} px
              <CopyButton text={String(backPx)} label="Copy" className="bg-white/15 text-white hover:bg-white/25" />
            </p>
          </div>
          <p className="text-xs font-semibold leading-relaxed text-ink-500">
            Multiply the height the same way: height_inches × {d} DPI. If your file has fewer pixels, expect softness — or resize wisely first.
          </p>
        </div>
      </div>
    </div>
  );
}
