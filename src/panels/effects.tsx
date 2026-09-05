import { useEffect, useMemo, useRef, useState } from "react";
import type { Tool } from "../lib/types";
import {
  applyCssFilter, canvasToBlob, hexToRgb, loadImageFromFile, luminance, makeCanvas, replaceExt,
  scaleImage, transformPixels, clamp, autoEnhance,
} from "../lib/image";
import { useImageInput, useOutput, ControlsCard, ToolGrid, ActionRow, errMsg } from "./state";
import { FileDropzone, ImagePreview, DownloadButton } from "../components/shared";
import { Alert, ColorInput, Field, Select, SliderControl, cx } from "../components/ui";

const FORMAT_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

/** Debounced small-canvas live preview for pixel-loop effects. */
function usePixelPreview(img: HTMLImageElement | null, render: (canvas: HTMLCanvasElement) => void, deps: unknown[]) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!img) return;
    const t = setTimeout(() => {
      const small = scaleImage(img, img.naturalWidth, img.naturalHeight, Math.min(640, img.naturalWidth), Math.round(Math.min(640, img.naturalWidth) * (img.naturalHeight / img.naturalWidth)));
      render(small);
      setUrl(small.toDataURL("image/png"));
    }, 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, ...deps]);
  return url;
}

function FormatSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Output format">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="image/jpeg">JPG</option>
        <option value="image/png">PNG</option>
        <option value="image/webp">WEBP</option>
      </Select>
    </Field>
  );
}

function EffectShell({ tool, input, out, controls, previewSrc, previewLabel, onProcess, busy, err, extra }: {
  tool: Tool;
  input: ReturnType<typeof useImageInput>;
  out: ReturnType<typeof useOutput>;
  controls: React.ReactNode;
  previewSrc: string | null;
  previewLabel: string;
  onProcess: () => void;
  busy: boolean;
  err: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <ToolGrid controls={controls}>
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <ImagePreview src={previewSrc ?? input.url} label={previewSrc ? previewLabel : "Live preview"} width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
            {extra}
          </div>
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Processed (full resolution)" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, "png")} label="Download image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
              Full-resolution result appears here
            </div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- CSS-filter slider tools ---------------- */

export function FilterSliderPanel({ tool }: { tool: Tool }) {
  const cfg = tool.config ?? {};
  const input = useImageInput();
  const out = useOutput();
  const [value, setValue] = useState<number>(cfg.def ?? 100);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const unit = cfg.unit === "°" ? "deg" : cfg.unit;
  const filterStr = `${cfg.f}(${value}${unit})`;

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const canvas = applyCssFilter(input.img, filterStr);
      const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : 0.92);
      const chk = await loadImageFromFile(blob);
      out.set(blob, chk.naturalWidth, chk.naturalHeight);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process} previewLabel="Original (live effect below)"
      previewSrc={input.url}
      controls={
        <ControlsCard title="Effect">
          <SliderControl label={tool.name.replace(/ Editor| Tool| Converter/g, "")} value={value} min={cfg.min} max={cfg.max} unit={cfg.unit} defaultValue={cfg.def} onChange={setValue} />
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setValue(cfg.def); setErr(null); }} processLabel={`${cfg.verb ?? "Apply"} & render`} />
        </ControlsCard>
      }
      extra={
        <div className="overflow-hidden rounded-xl border border-ink-200/70 checker dark:border-ink-700/60">
          <img src={input.url!} alt="Effect preview" style={{ filter: filterStr }} className="max-h-[300px] w-full object-contain transition-[filter] duration-150" />
        </div>
      }
    />
  );
}

/* ---------------- Black & white threshold ---------------- */

export function BwPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [threshold, setThreshold] = useState(128);
  const [format, setFormat] = useState("image/png");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = (c: HTMLCanvasElement) =>
    transformPixels(c, (d) => {
      for (let i = 0; i < d.length; i += 4) {
        const v = luminance(d[i], d[i + 1], d[i + 2]) >= threshold ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    });

  const preview = usePixelPreview(input.img, apply, [threshold]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      c.getContext("2d")!.drawImage(input.img, 0, 0);
      apply(c);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process}
      previewSrc={preview} previewLabel={`Threshold ${threshold}`}
      controls={
        <ControlsCard title="Threshold">
          <SliderControl label="Luminance threshold" value={threshold} min={10} max={245} defaultValue={128} onChange={setThreshold} />
          <p className="text-xs leading-relaxed text-ink-500">Pixels brighter than the threshold become white; darker become pure black.</p>
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setThreshold(128); setErr(null); }} processLabel="Convert to B&W" />
        </ControlsCard>
      }
    />
  );
}

/* ---------------- Sharpen ---------------- */

export function SharpenPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [strength, setStrength] = useState(35);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sharpen = (c: HTMLCanvasElement, k: number) =>
    transformPixels(c, (d) => {
      const w = c.width, h = c.height;
      const src = new Uint8ClampedArray(d);
      const kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          for (let ch = 0; ch < 3; ch++) {
            let sum = 0, ki = 0;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++)
                sum += src[((y + dy) * w + (x + dx)) * 4 + ch] * kernel[ki++];
            d[(y * w + x) * 4 + ch] = clamp(sum, 0, 255);
          }
        }
      }
    });

  const k = strength / 100 * 1.4;
  const preview = usePixelPreview(input.img, (c) => sharpen(c, k), [strength]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const cap = 1800;
      const scale = Math.min(1, cap / Math.max(input.img.naturalWidth, input.img.naturalHeight));
      const c = scaleImage(input.img, input.img.naturalWidth, input.img.naturalHeight, input.img.naturalWidth * scale, input.img.naturalHeight * scale);
      sharpen(c, k);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process}
      previewSrc={preview} previewLabel={`Sharpened ${strength}% (preview)`}
      controls={
        <ControlsCard title="Sharpening">
          <SliderControl label="Strength" value={strength} min={5} max={100} unit="%" defaultValue={35} onChange={setStrength} />
          <p className="text-xs leading-relaxed text-ink-500">Real convolution sharpening. Above ~60% you may see halos around edges.</p>
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setStrength(35); setErr(null); }} processLabel="Sharpen image" />
        </ControlsCard>
      }
    />
  );
}

/* ---------------- Auto enhance ---------------- */

const MODES = [
  ["normal", "Normal — balanced correction"],
  ["vivid", "Vivid — punchy color"],
  ["bright", "Bright — airy & light"],
  ["warm", "Warm — golden tones"],
  ["cool", "Cool — crisp daylight"],
] as const;

export function EnhancePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("normal");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filter = useMemo(() => (input.img ? autoEnhance(input.img, mode) : ""), [input.img, mode]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = applyCssFilter(input.img, filter);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process} previewLabel="Original (enhanced live below)"
      previewSrc={input.url}
      controls={
        <ControlsCard title="Enhancement mode">
          <div className="space-y-2">
            {MODES.map(([key, label]) => (
              <button key={key} onClick={() => setMode(key)} className={cx("focus-ring w-full rounded-lg border px-3.5 py-2.5 text-left text-[13px] font-bold transition-colors", mode === key ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300")}>
                {label}
              </button>
            ))}
          </div>
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold leading-relaxed text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
            Analyzes the histogram and stretches tonal range — classic algorithms, honestly labeled (no AI claims).
          </p>
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Enhance image" />
        </ControlsCard>
      }
      extra={
        filter ? (
          <div className="overflow-hidden rounded-xl border border-ink-200/70 checker dark:border-ink-700/60">
            <img src={input.url!} alt="Enhanced preview" style={{ filter }} className="max-h-[300px] w-full object-contain" />
          </div>
        ) : null
      }
    />
  );
}

/* ---------------- Color temperature ---------------- */

export function TemperaturePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [temp, setTemp] = useState(0);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = (c: HTMLCanvasElement) =>
    transformPixels(c, (d) => {
      const shift = temp * 0.45;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp(d[i] + shift, 0, 255);
        d[i + 2] = clamp(d[i + 2] - shift, 0, 255);
      }
    });

  const preview = usePixelPreview(input.img, apply, [temp]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      c.getContext("2d")!.drawImage(input.img, 0, 0);
      apply(c);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process}
      previewSrc={preview} previewLabel={temp > 0 ? `Warmer +${temp}` : temp < 0 ? `Cooler ${temp}` : "Neutral"}
      controls={
        <ControlsCard title="Temperature">
          <SliderControl label="Warm ↔ Cool" value={temp} min={-100} max={100} defaultValue={0} onChange={setTemp} />
          <div className="flex justify-between text-[11px] font-bold text-ink-400"><span>❄ Cool</span><span>Warm ☀</span></div>
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setTemp(0); setErr(null); }} processLabel="Apply temperature" />
        </ControlsCard>
      }
    />
  );
}

/* ---------------- Vignette ---------------- */

export function VignettePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [strength, setStrength] = useState(55);
  const [radius, setRadius] = useState(65);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = (c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d")!;
    const cxp = c.width / 2, cyp = c.height / 2;
    const outer = Math.hypot(cxp, cyp);
    const inner = outer * (radius / 100) * 0.9;
    const g = ctx.createRadialGradient(cxp, cyp, inner, cxp, cyp, outer);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${strength / 100})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const preview = usePixelPreview(input.img, apply, [strength, radius]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      c.getContext("2d")!.drawImage(input.img, 0, 0);
      apply(c);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process}
      previewSrc={preview} previewLabel="Vignette preview"
      controls={
        <ControlsCard title="Vignette">
          <SliderControl label="Strength" value={strength} min={0} max={100} unit="%" defaultValue={55} onChange={setStrength} />
          <SliderControl label="Radius" value={radius} min={20} max={100} unit="%" defaultValue={65} onChange={setRadius} />
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setStrength(55); setRadius(65); setErr(null); }} processLabel="Add vignette" />
        </ControlsCard>
      }
    />
  );
}

/* ---------------- Vintage presets ---------------- */

const VINTAGE = [
  ["Retro", "sepia(0.42) contrast(1.08) saturate(1.3) brightness(1.03)"],
  ["Warm Memory", "sepia(0.3) brightness(1.06) contrast(0.95) saturate(1.12)"],
  ["Cool Fade", "saturate(0.72) contrast(0.9) brightness(1.1) hue-rotate(-8deg)"],
  ["High Contrast Mono", "grayscale(1) contrast(1.35) brightness(1.03)"],
  ["Soft Glow", "blur(0.7px) brightness(1.08) saturate(1.18) contrast(0.96)"],
] as const;

export function VintagePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [preset, setPreset] = useState(0);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = applyCssFilter(input.img, VINTAGE[preset][1]);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process} previewLabel="Original (preset live below)"
      previewSrc={input.url}
      controls={
        <ControlsCard title="Film presets">
          <div className="space-y-2">
            {VINTAGE.map(([label], i) => (
              <button key={label} onClick={() => setPreset(i)} className={cx("focus-ring w-full rounded-lg border px-3.5 py-2.5 text-left text-[13px] font-bold transition-colors", preset === i ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300")}>
                {label}
              </button>
            ))}
          </div>
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel={`Apply ${VINTAGE[preset][0]}`} />
        </ControlsCard>
      }
      extra={
        <div className="overflow-hidden rounded-xl border border-ink-200/70 checker dark:border-ink-700/60">
          <img src={input.url!} alt="Vintage preview" style={{ filter: VINTAGE[preset][1] }} className="max-h-[300px] w-full object-contain transition-[filter] duration-200" />
        </div>
      }
    />
  );
}

/* ---------------- Color overlay ---------------- */

export function OverlayPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [color, setColor] = useState("#1f7571");
  const [opacity, setOpacity] = useState(35);
  const [blend, setBlend] = useState("source-over");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = (c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d")!;
    ctx.globalAlpha = opacity / 100;
    ctx.globalCompositeOperation = blend as GlobalCompositeOperation;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  const preview = usePixelPreview(input.img, apply, [color, opacity, blend]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      c.getContext("2d")!.drawImage(input.img, 0, 0);
      apply(c);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process}
      previewSrc={preview} previewLabel="Overlay preview"
      controls={
        <ControlsCard title="Overlay">
          <ColorInput label="Overlay color" value={color} onChange={setColor} />
          <SliderControl label="Opacity" value={opacity} min={0} max={100} unit="%" defaultValue={35} onChange={setOpacity} />
          <Field label="Blend mode">
            <Select value={blend} onChange={(e) => setBlend(e.target.value)}>
              <option value="source-over">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="soft-light">Soft light</option>
            </Select>
          </Field>
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Apply overlay" />
        </ControlsCard>
      }
    />
  );
}

/* ---------------- Duotone ---------------- */

export function DuotonePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [shadow, setShadow] = useState("#0f2440");
  const [highlight, setHighlight] = useState("#f5c84c");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = (c: HTMLCanvasElement) => {
    const [sr, sg, sb] = hexToRgb(shadow);
    const [hr, hg, hb] = hexToRgb(highlight);
    transformPixels(c, (d) => {
      for (let i = 0; i < d.length; i += 4) {
        const t = luminance(d[i], d[i + 1], d[i + 2]) / 255;
        d[i] = sr + (hr - sr) * t;
        d[i + 1] = sg + (hg - sg) * t;
        d[i + 2] = sb + (hb - sb) * t;
      }
    });
  };

  const preview = usePixelPreview(input.img, apply, [shadow, highlight]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      c.getContext("2d")!.drawImage(input.img, 0, 0);
      apply(c);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <EffectShell
      tool={tool} input={input} out={out} busy={busy} err={err} onProcess={process}
      previewSrc={preview} previewLabel="Duotone preview"
      controls={
        <ControlsCard title="Duotone colors">
          <ColorInput label="Shadow color (darks)" value={shadow} onChange={setShadow} />
          <ColorInput label="Highlight color (lights)" value={highlight} onChange={setHighlight} />
          <div className="h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${shadow}, ${highlight})` }} aria-hidden />
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Apply duotone" />
        </ControlsCard>
      }
    />
  );
}
