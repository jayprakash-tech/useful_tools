import { useEffect, useRef, useState } from "react";
import type { Tool } from "../lib/types";
import {
  canvasToBlob, clamp, downloadBlob, downloadDataUrl, formatBytes, loadImageFromFile, makeCanvas,
  makeZip, replaceExt, scaleImage,
} from "../lib/image";
import { useImageInput, useOutput, ControlsCard, ToolGrid, ActionRow, errMsg } from "./state";
import { FileDropzone, ImagePreview, DownloadButton } from "../components/shared";
import { Alert, Button, ColorInput, CopyButton, Field, Select, SliderControl, TextInput, useToast } from "../components/ui";

/* ---------------- Favicon generator ---------------- */

const FAV_SIZES = [16, 32, 48, 64, 180];

export function FaviconPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const [icons, setIcons] = useState<{ size: number; blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const generate = async () => {
    if (!input.img) return;
    setBusy(true); setErr(null);
    icons.forEach((i) => URL.revokeObjectURL(i.url));
    setIcons([]);
    try {
      const img = input.img;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
      const square = makeCanvas(side, side);
      square.getContext("2d")!.drawImage(img, sx, sy, side, side, 0, 0, side, side);
      const next: { size: number; blob: Blob; url: string }[] = [];
      for (const s of FAV_SIZES) {
        const c = scaleImage(square, side, side, s, s);
        const blob = await canvasToBlob(c, "image/png");
        next.push({ size: s, blob, url: URL.createObjectURL(blob) });
      }
      setIcons(next);
      toast("Favicon set generated");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const zipAll = async () => {
    const blob = await makeZip(icons.map((i) => ({ name: i.size === 180 ? "apple-touch-icon.png" : `favicon-${i.size}x${i.size}.png`, data: i.blob })));
    downloadBlob("favicon-set.zip", blob);
    toast("ZIP downloaded");
  };

  const snippet = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`;

  return (
    <div className="space-y-6">
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} title="Drop a square logo or icon" subtitle="Non-square images are center-cropped — or" />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <ToolGrid
          controls={
            <ControlsCard title="Icon sizes">
              <div className="flex flex-wrap gap-2">
                {FAV_SIZES.map((s) => (
                  <span key={s} className="rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1 font-mono text-xs font-bold text-ink-600 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300">
                    {s}×{s}{s === 180 ? " (apple)" : ""}
                  </span>
                ))}
              </div>
              <ActionRow hasInput busy={busy} onProcess={generate} onReset={() => { input.reset(); icons.forEach((i) => URL.revokeObjectURL(i.url)); setIcons([]); setErr(null); }} processLabel="Generate favicon set" />
            </ControlsCard>
          }
        >
          {icons.length > 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {icons.map((i) => (
                  <div key={i.size} className="flex flex-col items-center gap-2 rounded-xl border border-ink-200/70 bg-white p-3 dark:border-ink-700/60 dark:bg-ink-900">
                    <div className="checker flex h-20 w-full items-center justify-center rounded-lg">
                      <img src={i.url} alt={`${i.size} by ${i.size} favicon`} width={Math.min(i.size, 64)} height={Math.min(i.size, 64)} style={{ imageRendering: i.size <= 32 ? "pixelated" : "auto" }} />
                    </div>
                    <span className="font-mono text-[11px] font-bold text-ink-500">{i.size}×{i.size}</span>
                    <DownloadButton blob={i.blob} filename={i.size === 180 ? "apple-touch-icon.png" : `favicon-${i.size}x${i.size}.png`} label="Save" />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-700/60 dark:bg-ink-900">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-ink-800 dark:text-ink-100">HTML snippet for your site</h3>
                  <CopyButton text={snippet} label="Copy snippet" />
                </div>
                <pre className="mt-3 overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-[11px] leading-relaxed text-ink-600 dark:bg-ink-950 dark:text-ink-300">{snippet}</pre>
              </div>
              <Button variant="dark" onClick={zipAll} className="w-full">Download all as ZIP</Button>
            </div>
          )}
          {icons.length === 0 && (
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
              Generated icons appear here at real scale
            </div>
          )}
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Placeholder ---------------- */

export function PlaceholderPanel({ tool }: { tool: Tool }) {
  const [w, setW] = useState("1200");
  const [h, setH] = useState("630");
  const [bg, setBg] = useState("#1c5e5b");
  const [fg, setFg] = useState("#ffffff");
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toast = useToast();

  const width = clamp(parseInt(w, 10) || 1200, 16, 4096);
  const height = clamp(parseInt(h, 10) || 630, 16, 4096);
  const text = label.trim() || `${width}×${height}`;

  useEffect(() => {
    const t = setTimeout(() => {
      const c = makeCanvas(width, height);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      const fs = Math.min(width, height) / 7;
      ctx.font = `800 ${fs}px Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = fg;
      ctx.fillText(text, width / 2, height / 2, width * 0.9);
      canvasRef.current = c;
      const small = scaleImage(c, width, height, Math.min(640, width), Math.round(Math.min(640, width) * (height / width)));
      setPreview(small.toDataURL("image/png"));
    }, 150);
    return () => clearTimeout(t);
  }, [width, height, bg, fg, text]);

  const download = async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current, "image/png");
    downloadBlob(`placeholder-${width}x${height}.png`, blob);
    toast("Placeholder downloaded");
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Placeholder settings">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width"><TextInput inputMode="numeric" value={w} onChange={(e) => setW(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Height"><TextInput inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <ColorInput label="Background color" value={bg} onChange={setBg} />
          <ColorInput label="Text color" value={fg} onChange={setFg} />
          <Field label="Label" hint="Defaults to the dimensions.">
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={text} />
          </Field>
          <Button onClick={download} className="w-full">Download PNG ({width}×{height})</Button>
        </ControlsCard>
      }
    >
      {preview ? (
        <div className="overflow-hidden rounded-xl border border-ink-200/70 shadow-soft dark:border-ink-700/60">
          <img src={preview} alt={`Placeholder ${width} by ${height}`} className="w-full" />
        </div>
      ) : null}
    </ToolGrid>
  );
}

/* ---------------- Solid color ---------------- */

export function SolidPanel({ tool }: { tool: Tool }) {
  const [w, setW] = useState("1920");
  const [h, setH] = useState("1080");
  const [color, setColor] = useState("#1f7571");
  const toast = useToast();

  const width = clamp(parseInt(w, 10) || 1920, 1, 4096);
  const height = clamp(parseInt(h, 10) || 1080, 1, 4096);

  const download = async () => {
    const c = makeCanvas(width, height);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    const blob = await canvasToBlob(c, "image/png");
    downloadBlob(`solid-${color.slice(1)}-${width}x${height}.png`, blob);
    toast("Solid image downloaded");
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Solid color">
          <ColorInput label="Color" value={color} onChange={setColor} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width"><TextInput inputMode="numeric" value={w} onChange={(e) => setW(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Height"><TextInput inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <Button onClick={download} className="w-full">Download PNG</Button>
        </ControlsCard>
      }
    >
      <div className="flex h-72 items-center justify-center rounded-xl border border-ink-200/70 shadow-soft transition-colors duration-200 dark:border-ink-700/60" style={{ background: color }}>
        <span className="rounded-full bg-black/25 px-3.5 py-1.5 font-mono text-xs font-bold text-white">{color.toUpperCase()} · {width}×{height}</span>
      </div>
    </ToolGrid>
  );
}

/* ---------------- Gradient ---------------- */

export function GradientPanel({ tool }: { tool: Tool }) {
  const [type, setType] = useState("linear");
  const [c1, setC1] = useState("#1c5e5b");
  const [c2, setC2] = useState("#0b1312");
  const [angle, setAngle] = useState(135);
  const [w, setW] = useState("1920");
  const [h, setH] = useState("1080");
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toast = useToast();

  const width = clamp(parseInt(w, 10) || 1920, 16, 4096);
  const height = clamp(parseInt(h, 10) || 1080, 16, 4096);

  useEffect(() => {
    const t = setTimeout(() => {
      const c = makeCanvas(width, height);
      const ctx = c.getContext("2d")!;
      let g: CanvasGradient;
      if (type === "radial") {
        g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 2);
      } else {
        const rad = ((angle - 90) * Math.PI) / 180;
        const cx = width / 2, cy = height / 2;
        const len = (Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))) / 2;
        g = ctx.createLinearGradient(cx - Math.sin(rad) * len, cy + Math.cos(rad) * len, cx + Math.sin(rad) * len, cy - Math.cos(rad) * len);
      }
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      canvasRef.current = c;
      const small = scaleImage(c, width, height, Math.min(640, width), Math.round(Math.min(640, width) * (height / width)));
      setPreview(small.toDataURL("image/jpeg", 0.9));
    }, 120);
    return () => clearTimeout(t);
  }, [type, c1, c2, angle, width, height]);

  const download = async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current, "image/png");
    downloadBlob(`gradient-${width}x${height}.png`, blob);
    toast("Gradient downloaded");
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Gradient">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </Select>
          </Field>
          <ColorInput label="Start color" value={c1} onChange={setC1} />
          <ColorInput label="End color" value={c2} onChange={setC2} />
          {type === "linear" && <SliderControl label="Angle" value={angle} min={0} max={360} unit="°" defaultValue={135} onChange={setAngle} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width"><TextInput inputMode="numeric" value={w} onChange={(e) => setW(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Height"><TextInput inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <Button onClick={download} className="w-full">Download PNG</Button>
        </ControlsCard>
      }
    >
      {preview && <img src={preview} alt="Gradient preview" className="w-full rounded-xl border border-ink-200/70 shadow-soft dark:border-ink-700/60" />}
    </ToolGrid>
  );
}

/* ---------------- QR code ---------------- */

export function QrPanel({ tool }: { tool: Tool }) {
  const [text, setText] = useState("https://");
  const [size, setSize] = useState(512);
  const [fg, setFg] = useState("#0b1312");
  const [bg, setBg] = useState("#ffffff");
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!text.trim() || text === "https://") { setPreview(null); return; }
      try {
        const QRCode = (await import("qrcode")).default ?? (await import("qrcode"));
        const url = await (QRCode as typeof import("qrcode")).toDataURL(text, {
          width: 320, margin: 2, errorCorrectionLevel: "M",
          color: { dark: fg, light: bg },
        });
        setPreview(url);
        setErr(null);
      } catch { setErr("Could not generate a QR code from this input."); }
    }, 200);
    return () => clearTimeout(t);
  }, [text, fg, bg]);

  const download = async () => {
    if (!text.trim()) { setErr("Enter a URL or text first."); return; }
    setBusy(true); setErr(null);
    try {
      const QRCode = (await import("qrcode")).default ?? (await import("qrcode"));
      const url = await (QRCode as typeof import("qrcode")).toDataURL(text, {
        width: size, margin: 2, errorCorrectionLevel: "M",
        color: { dark: fg, light: bg },
      });
      downloadDataUrl(`qr-code-${size}.png`, url);
      toast("QR code downloaded");
    } catch { setErr("Could not generate a QR code from this input."); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="QR content">
          <Field label="URL or text">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="focus-ring w-full rounded-lg border border-ink-200 bg-white p-3 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
          </Field>
          <Field label="Output size">
            <Select value={String(size)} onChange={(e) => setSize(Number(e.target.value))}>
              <option value="256">256 × 256</option>
              <option value="512">512 × 512</option>
              <option value="1024">1024 × 1024 (print)</option>
            </Select>
          </Field>
          <ColorInput label="Code color" value={fg} onChange={setFg} />
          <ColorInput label="Background" value={bg} onChange={setBg} />
          <Button onClick={download} busy={busy} className="w-full" disabled={!text.trim()}>Download PNG</Button>
        </ControlsCard>
      }
    >
      {err && <Alert tone="error">{err}</Alert>}
      {preview ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-ink-200/70 bg-white p-8 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
          <img src={preview} alt={`QR code for ${text.slice(0, 40)}`} className="w-64 max-w-full rounded-lg" />
          <p className="max-w-full truncate font-mono text-xs font-semibold text-ink-400">{text}</p>
        </div>
      ) : (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
          QR code preview appears as you type
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- OG image ---------------- */

export function OgPanel({ tool }: { tool: Tool }) {
  const [title, setTitle] = useState("My article title");
  const [subtitle, setSubtitle] = useState("A subtitle that explains more");
  const [mode, setMode] = useState("gradient");
  const [c1, setC1] = useState("#1c5e5b");
  const [c2, setC2] = useState("#0b1312");
  const [align, setAlign] = useState("left");
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      const W = 1200, H = 630;
      const c = makeCanvas(W, H);
      const ctx = c.getContext("2d")!;
      if (mode === "gradient") {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g;
      } else ctx.fillStyle = c1;
      ctx.fillRect(0, 0, W, H);
      const mx = 90;
      const centerX = align === "center";
      ctx.textAlign = centerX ? "center" : "left";
      const x = centerX ? W / 2 : mx;
      let y = logo ? 200 : 250;
      if (logo) {
        const lh = 84;
        const lw = lh * (logo.naturalWidth / logo.naturalHeight);
        ctx.drawImage(logo, centerX ? (W - lw) / 2 : mx, 90, lw, lh);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 74px 'Bricolage Grotesque', Manrope, sans-serif";
      const words = title.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width > W - mx * 2 && cur) { lines.push(cur); cur = w; } else cur = test;
      }
      if (cur) lines.push(cur);
      lines.slice(0, 3).forEach((l) => { ctx.fillText(l, x, y); y += 88; });
      if (subtitle.trim()) {
        ctx.font = "500 38px Manrope, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.fillText(subtitle.slice(0, 60), x, y + 26);
      }
      canvasRef.current = c;
      setPreview(scaleImage(c, W, H, 640, 336).toDataURL("image/jpeg", 0.9));
    }, 150);
    return () => clearTimeout(t);
  }, [title, subtitle, mode, c1, c2, align, logo]);

  const download = async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current, "image/png");
    downloadBlob("og-image-1200x630.png", blob);
    toast("OG image downloaded");
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Card content">
          <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Subtitle"><TextInput value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
          <Field label="Background">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="gradient">Gradient</option>
              <option value="solid">Solid color</option>
            </Select>
          </Field>
          <ColorInput label={mode === "gradient" ? "Color A" : "Color"} value={c1} onChange={setC1} />
          {mode === "gradient" && <ColorInput label="Color B" value={c2} onChange={setC2} />}
          <Field label="Alignment">
            <Select value={align} onChange={(e) => setAlign(e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
            </Select>
          </Field>
          <label className="block cursor-pointer rounded-lg border border-dashed border-ink-300 px-3 py-2.5 text-center text-xs font-bold text-ink-500 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-ink-600">
            {logo ? "✓ Logo added — click to replace" : "Add optional logo (click)"}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) try { setLogo(await loadImageFromFile(f)); } catch { toast("Could not load logo", "error"); } }} />
          </label>
          <Button onClick={download} className="w-full">Download 1200×630 PNG</Button>
        </ControlsCard>
      }
    >
      {preview && (
        <div className="overflow-hidden rounded-xl border border-ink-200/70 shadow-lift dark:border-ink-700/60">
          <img src={preview} alt="Open Graph card preview" className="w-full" />
          <p className="border-t border-ink-200/70 bg-ink-50 px-3.5 py-2 text-xs font-bold text-ink-400 dark:border-ink-700/60 dark:bg-ink-800">
            Exactly 1200 × 630 — the canonical og:image size
          </p>
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Before / After ---------------- */

export function BeforeAfterPanel({ tool }: { tool: Tool }) {
  const [a, setA] = useState<{ url: string; name: string } | null>(null);
  const [b, setB] = useState<{ url: string; name: string } | null>(null);
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = (which: "a" | "b") => (f: File) => {
    const url = URL.createObjectURL(f);
    if (which === "a") { if (a) URL.revokeObjectURL(a.url); setA({ url, name: f.name }); }
    else { if (b) URL.revokeObjectURL(b.url); setB({ url, name: f.name }); }
  };

  const onPointer = (e: React.PointerEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setPos(clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100));
    };
    move(e.nativeEvent);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!a || !b) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <FileDropzone accept={tool.accept} onFiles={(f) => load("a")(f[0])} title={a ? `✓ ${a.name}` : "1 · Upload the BEFORE image"} />
        <FileDropzone accept={tool.accept} onFiles={(f) => load("b")(f[0])} title={b ? `✓ ${b.name}` : "2 · Upload the AFTER image"} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        ref={wrapRef}
        onPointerDown={onPointer}
        className="relative mx-auto max-w-3xl cursor-ew-resize touch-none select-none overflow-hidden rounded-xl border border-ink-200/70 shadow-lift dark:border-ink-700/60"
      >
        <img src={a.url} alt={`Before: ${a.name}`} className="block w-full" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <img src={b.url} alt={`After: ${b.name}`} className="block h-full w-full object-cover" draggable={false} />
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
          <div className="absolute top-1/2 -ml-[18px] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-800 shadow-lift">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M5 3 1.5 8 5 13M11 3l3.5 5L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Before</span>
        <span className="absolute right-3 top-3 rounded-full bg-brand-600/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">After</span>
      </div>
      <div className="mx-auto max-w-3xl space-y-3">
        <input
          type="range" min={0} max={100} value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Comparison slider position"
          className="w-full"
          style={{ ["--fill" as string]: `${pos}%` }}
        />
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={() => { URL.revokeObjectURL(a.url); setA(null); }}>Replace before</Button>
          <Button variant="secondary" onClick={() => { URL.revokeObjectURL(b.url); setB(null); }}>Replace after</Button>
        </div>
      </div>
    </div>
  );
}
