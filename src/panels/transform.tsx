import { Suspense, lazy, useCallback, useState } from "react";
import type { Tool } from "../lib/types";
import {
  canvasToBlob, clamp, formatBytes, makeCanvas, percentSaved, replaceExt, roundedRectPath, scaleImage,
} from "../lib/image";
import { useImageInput, useOutput, ControlsCard, ToolGrid, ActionRow, errMsg } from "./state";
import { FileDropzone, ImagePreview, DownloadButton, Stat } from "../components/shared";
import { Alert, Button, ColorInput, Field, Select, SliderControl, TextInput, cx } from "../components/ui";
import { Loader2, RefreshCw } from "lucide-react";

const Cropper = lazy(() => import("react-easy-crop"));
type Area = { x: number; y: number; width: number; height: number };

const FORMAT_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

async function renderCrop(img: HTMLImageElement, crop: Area, type: string, quality?: number) {
  const c = makeCanvas(crop.width, crop.height);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return canvasToBlob(c, type, quality);
}

/* ---------------- Image resizer ---------------- */

export function ResizePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [mode, setMode] = useState("px");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [pct, setPct] = useState(50);
  const [lock, setLock] = useState(true);
  const [format, setFormat] = useState("image/png");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onW = (v: string) => {
    setWidth(v);
    if (lock && input.img && v) setHeight(String(Math.round((parseInt(v, 10) * input.img.naturalHeight) / input.img.naturalWidth)));
  };
  const onH = (v: string) => {
    setHeight(v);
    if (lock && input.img && v) setWidth(String(Math.round((parseInt(v, 10) * input.img.naturalWidth) / input.img.naturalHeight)));
  };

  const target = () => {
    if (!input.img) return null;
    if (mode === "pct") {
      const f = pct / 100;
      return { w: Math.max(1, Math.round(input.img.naturalWidth * f)), h: Math.max(1, Math.round(input.img.naturalHeight * f)) };
    }
    const w = parseInt(width, 10), h = parseInt(height, 10);
    if (!w || !h) return null;
    return { w, h };
  };

  const process = async () => {
    const t = target();
    if (!input.img || !input.file || !t) { setErr("Enter valid dimensions."); return; }
    setErr(null); setBusy(true); out.reset();
    try {
      const canvas = scaleImage(input.img, input.img.naturalWidth, input.img.naturalHeight, t.w, t.h);
      const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : 0.9);
      out.set(blob, canvas.width, canvas.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const t = target();
  return (
    <ToolGrid
      controls={
        <ControlsCard title="Resize options">
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="px">Exact pixels</option>
              <option value="pct">Percentage</option>
            </Select>
          </Field>
          {mode === "px" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Width"><TextInput inputMode="numeric" value={width} onChange={(e) => onW(e.target.value.replace(/\D/g, ""))} placeholder="1200" /></Field>
                <Field label="Height"><TextInput inputMode="numeric" value={height} onChange={(e) => onH(e.target.value.replace(/\D/g, ""))} placeholder="800" /></Field>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink-700 dark:text-ink-200">
                <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                Maintain aspect ratio
              </label>
            </>
          ) : (
            <SliderControl label="Scale" value={pct} min={1} max={200} unit="%" defaultValue={50} onChange={setPct} />
          )}
          {t && <p className="rounded-lg bg-brand-50 px-3 py-2 font-mono text-xs font-bold text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">→ {t.w} × {t.h} px</p>}
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Resize image" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Resized" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download resized image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Resized preview appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

export const PercentResizePanel = ResizePanel;

/* ---------------- Aspect ratio resizer ---------------- */

const RATIOS: [string, number][] = [["1:1", 1], ["4:3", 4 / 3], ["16:9", 16 / 9], ["9:16", 9 / 16], ["3:2", 3 / 2], ["2:3", 2 / 3]];

export function AspectResizePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [ratioKey, setRatioKey] = useState("16:9");
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [baseW, setBaseW] = useState("1280");
  const [fitMode, setFitMode] = useState("fill");
  const [bg, setBg] = useState("#ffffff");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ratio = ratioKey === "custom"
    ? (parseInt(customW, 10) || 16) / (parseInt(customH, 10) || 9)
    : RATIOS.find(([k]) => k === ratioKey)![1];
  const bw = clamp(parseInt(baseW, 10) || 1280, 16, 4096);
  const bh = Math.max(16, Math.round(bw / ratio));

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const img = input.img;
      const canvas = makeCanvas(bw, bh);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      if (fitMode === "fit") {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, bw, bh);
        const r = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
        const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
        ctx.drawImage(img, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
      } else {
        const r = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
        const sw = bw / r, sh = bh / r;
        ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, bw, bh);
      }
      const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : 0.9);
      out.set(blob, bw, bh);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Aspect ratio">
          <div className="grid grid-cols-3 gap-2">
            {RATIOS.map(([k]) => (
              <button key={k} onClick={() => setRatioKey(k)} className={cx("focus-ring rounded-lg border px-2 py-2 font-mono text-xs font-bold transition-colors", ratioKey === k ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300")}>
                {k}
              </button>
            ))}
            <button onClick={() => setRatioKey("custom")} className={cx("focus-ring rounded-lg border px-2 py-2 font-mono text-xs font-bold", ratioKey === "custom" ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300")}>
              Custom
            </button>
          </div>
          {ratioKey === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ratio W"><TextInput inputMode="numeric" value={customW} onChange={(e) => setCustomW(e.target.value.replace(/\D/g, ""))} placeholder="21" /></Field>
              <Field label="Ratio H"><TextInput inputMode="numeric" value={customH} onChange={(e) => setCustomH(e.target.value.replace(/\D/g, ""))} placeholder="9" /></Field>
            </div>
          )}
          <Field label="Base width (px)" hint="Height is calculated from the ratio.">
            <TextInput inputMode="numeric" value={baseW} onChange={(e) => setBaseW(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Mode">
            <Select value={fitMode} onChange={(e) => setFitMode(e.target.value)}>
              <option value="fill">Fill — crop to cover the ratio</option>
              <option value="fit">Fit — letterbox inside the ratio</option>
            </Select>
          </Field>
          {fitMode === "fit" && <ColorInput label="Letterbox color" value={bg} onChange={setBg} />}
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          <p className="rounded-lg bg-brand-50 px-3 py-2 font-mono text-xs font-bold text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">→ {bw} × {bh} px</p>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Resize to ratio" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Resized" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Result appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Interactive crop ---------------- */

export function CropPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doCrop = async () => {
    if (!input.img || !areaPx) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const blob = await renderCrop(input.img, areaPx, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, areaPx.width, areaPx.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <ToolGrid
          controls={
            <ControlsCard title="Crop settings">
              <Field label="Aspect ratio">
                <Select value={aspect === undefined ? "free" : String(aspect)} onChange={(e) => setAspect(e.target.value === "free" ? undefined : Number(e.target.value))}>
                  <option value="free">Free crop</option>
                  <option value="1">1:1 square</option>
                  <option value={4 / 3}>4:3</option>
                  <option value={16 / 9}>16:9</option>
                  <option value={9 / 16}>9:16</option>
                  <option value={3 / 2}>3:2</option>
                </Select>
              </Field>
              <SliderControl label="Zoom" value={Math.round(zoom * 100)} min={100} max={300} unit="%" defaultValue={100} onChange={(v) => setZoom(v / 100)} />
              {areaPx && <p className="rounded-lg bg-brand-50 px-3 py-2 font-mono text-xs font-bold text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">→ {areaPx.width} × {areaPx.height} px</p>}
              <Field label="Output format">
                <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WEBP</option>
                </Select>
              </Field>
              <ActionRow hasInput busy={busy} onProcess={doCrop} onReset={() => { input.reset(); out.reset(); setErr(null); setZoom(1); setCrop({ x: 0, y: 0 }); }} processLabel="Crop image" />
            </ControlsCard>
          }
        >
          <div className="relative h-[380px] overflow-hidden rounded-xl border border-ink-200/70 bg-ink-950 dark:border-ink-700/60">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-white"><Loader2 className="spin" size={24} /></div>}>
              <Cropper
                image={input.url}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={useCallback((_: Area, px: Area) => setAreaPx(px), [])}
              />
            </Suspense>
          </div>
          {out.url && (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Cropped result" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download cropped image" />
            </div>
          )}
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Fixed size crop ---------------- */

const GENERAL_PRESETS = [
  ["Instagram post", 1080, 1080], ["Instagram story", 1080, 1920], ["YouTube thumbnail", 1280, 720],
  ["Facebook post", 1200, 630], ["X (Twitter) post", 1600, 900], ["Profile picture", 400, 400],
] as const;
const SOCIAL_PRESETS = [
  ["Instagram post", 1080, 1080], ["Instagram story", 1080, 1920], ["Facebook post", 1200, 630],
  ["YouTube thumbnail", 1280, 720], ["X (Twitter) post", 1600, 900], ["LinkedIn banner", 1584, 396],
] as const;

export function FixedCropPanel({ tool }: { tool: Tool }) {
  const presets = tool.config?.presets === "social" ? SOCIAL_PRESETS : GENERAL_PRESETS;
  const input = useImageInput();
  const out = useOutput();
  const [preset, setPreset] = useState(0);
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [cover, setCover] = useState(true);
  const [bg, setBg] = useState("#ffffff");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isCustom = preset === -1;
  const tw = isCustom ? clamp(parseInt(customW, 10) || 0, 16, 4096) : presets[preset][1];
  const th = isCustom ? clamp(parseInt(customH, 10) || 0, 16, 4096) : presets[preset][2];

  const process = async () => {
    if (!input.img || !input.file || !tw || !th) { setErr("Enter valid custom dimensions."); return; }
    setBusy(true); setErr(null); out.reset();
    try {
      const img = input.img;
      const c = makeCanvas(tw, th);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      if (!cover) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, tw, th);
      }
      const r = cover ? Math.max(tw / img.naturalWidth, th / img.naturalHeight) : Math.min(tw / img.naturalWidth, th / img.naturalHeight);
      const sw = tw / r, sh = th / r;
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, tw, th);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, tw, th);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const name = isCustom ? "custom" : String(presets[preset][0]).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <ToolGrid
      controls={
        <ControlsCard title="Preset size">
          <div className="grid grid-cols-2 gap-2">
            {presets.map(([label, w, h], i) => (
              <button key={label} onClick={() => setPreset(i)} className={cx("focus-ring rounded-lg border px-2 py-2 text-left transition-colors", preset === i ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800")}>
                <span className={cx("block text-xs font-bold", preset === i ? "text-white" : "text-ink-700 dark:text-ink-200")}>{label}</span>
                <span className={cx("block font-mono text-[10px]", preset === i ? "text-white/80" : "text-ink-400")}>{w}×{h}</span>
              </button>
            ))}
            <button onClick={() => setPreset(-1)} className={cx("focus-ring rounded-lg border px-2 py-2 text-left", isCustom ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800")}>
              <span className={cx("block text-xs font-bold", isCustom ? "text-white" : "text-ink-700 dark:text-ink-200")}>Custom</span>
              <span className={cx("block font-mono text-[10px]", isCustom ? "text-white/80" : "text-ink-400")}>any size</span>
            </button>
          </div>
          {isCustom && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Width"><TextInput inputMode="numeric" value={customW} onChange={(e) => setCustomW(e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label="Height"><TextInput inputMode="numeric" value={customH} onChange={(e) => setCustomH(e.target.value.replace(/\D/g, ""))} /></Field>
            </div>
          )}
          <Field label="Fit mode">
            <Select value={cover ? "cover" : "contain"} onChange={(e) => setCover(e.target.value === "cover")}>
              <option value="cover">Cover — fill & crop</option>
              <option value="contain">Contain — fit inside & pad</option>
            </Select>
          </Field>
          {!cover && <ColorInput label="Padding color" value={bg} onChange={setBg} />}
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel={`Create ${tw}×${th}`} />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Result" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={`${name}-${tw}x${th}.${FORMAT_EXT[format]}`} label="Download image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Result appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Profile picture ---------------- */

export function ProfilePicPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [pad, setPad] = useState(0);
  const [bg, setBg] = useState("#1f7571");
  const [size, setSize] = useState(512);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !areaPx) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const cropped = await renderCrop(input.img, areaPx, "image/png");
      const cimg = await (await import("../lib/image")).loadImageFromFile(cropped);
      const S = size;
      const c = makeCanvas(S, S);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);
      const inner = S - pad * 2 * (S / 512);
      ctx.save();
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, inner / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(cimg, (S - inner) / 2, (S - inner) / 2, inner, inner);
      ctx.restore();
      const blob = await canvasToBlob(c, "image/png");
      out.set(blob, S, S);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} title="Drop a photo of yourself" />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <ToolGrid
          controls={
            <ControlsCard title="Avatar settings">
              <SliderControl label="Zoom" value={Math.round(zoom * 100)} min={100} max={300} unit="%" defaultValue={100} onChange={(v) => setZoom(v / 100)} />
              <SliderControl label="Padding" value={pad} min={0} max={120} unit="px" defaultValue={0} onChange={setPad} />
              <ColorInput label="Background color" value={bg} onChange={setBg} />
              <Field label="Output size">
                <Select value={String(size)} onChange={(e) => setSize(Number(e.target.value))}>
                  <option value="256">256 × 256</option>
                  <option value="512">512 × 512</option>
                  <option value="1024">1024 × 1024</option>
                </Select>
              </Field>
              <ActionRow hasInput busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Create avatar" />
            </ControlsCard>
          }
        >
          <div className="relative h-[360px] overflow-hidden rounded-xl border border-ink-200/70 bg-ink-950 dark:border-ink-700/60">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-white"><Loader2 className="spin" size={24} /></div>}>
              <Cropper
                image={input.url}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={useCallback((_: Area, px: Area) => setAreaPx(px), [])}
              />
            </Suspense>
          </div>
          {out.url && (
            <div className="grid items-center gap-5 md:grid-cols-2">
              <ImagePreview src={out.url} label="Your avatar" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} checker />
              <DownloadButton blob={out.blob} filename={`profile-picture-${size}.png`} label="Download PNG avatar" />
            </div>
          )}
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Rotate ---------------- */

export function RotatePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [angle, setAngle] = useState(0);
  const [format, setFormat] = useState("image/png");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const img = input.img;
      const rad = (angle * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
      const w = Math.round(img.naturalWidth * cos + img.naturalHeight * sin);
      const h = Math.round(img.naturalWidth * sin + img.naturalHeight * cos);
      const c = makeCanvas(w, h);
      const ctx = c.getContext("2d")!;
      if (format === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, w, h);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const btn = "focus-ring rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-bold text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300";
  return (
    <ToolGrid
      controls={
        <ControlsCard title="Rotation">
          <div className="grid grid-cols-3 gap-2">
            <button className={btn} onClick={() => setAngle((a) => (a + 90) % 360)}>90° CW</button>
            <button className={btn} onClick={() => setAngle(180)}>180°</button>
            <button className={btn} onClick={() => setAngle((a) => (a + 270) % 360)}>90° CCW</button>
          </div>
          <SliderControl label="Fine angle" value={angle} min={0} max={359} unit="°" defaultValue={0} onChange={setAngle} />
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/png">PNG (transparent corners)</option>
              <option value="image/jpeg">JPG (white corners)</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setAngle(0); setErr(null); }} processLabel="Rotate & download-ready" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-ink-200/70 checker p-4 dark:border-ink-700/60">
            <img src={input.url} alt="Rotation preview" style={{ transform: `rotate(${angle}deg)`, maxWidth: "70%", maxHeight: 300 }} className="rounded object-contain shadow-sm transition-transform duration-200" />
          </div>
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Rotated" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download rotated image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Rotated result appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Flip / Mirror ---------------- */

export function FlipPanel({ tool }: { tool: Tool }) {
  const modes: string[] = tool.config?.modes ?? ["h", "v"];
  const input = useImageInput();
  const out = useOutput();
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [format, setFormat] = useState("image/png");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const img = input.img;
      const c = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext("2d")!;
      ctx.translate(flipH ? c.width : 0, flipV ? c.height : 0);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, 0, 0);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, c.width, c.height);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const btn = (active: boolean) =>
    cx("focus-ring flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition-all", active ? "border-brand-600 bg-brand-600 text-white shadow-soft" : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300");

  return (
    <ToolGrid
      controls={
        <ControlsCard title={tool.config?.mirror ? "Mirror direction" : "Flip direction"}>
          {modes.includes("h") && (
            <button className={cx(btn(flipH), "w-full")} onClick={() => setFlipH((v) => !v)}>
              <RefreshCw size={15} className={flipH ? "" : "opacity-50"} aria-hidden /> {tool.config?.mirror ? (flipH ? "Mirrored left ↔ right" : "Mirror left ↔ right") : "Flip horizontal"}
            </button>
          )}
          {modes.includes("v") && (
            <button className={cx(btn(flipV), "w-full")} onClick={() => setFlipV((v) => !v)}>
              <RefreshCw size={15} className={cx("rotate-90", !flipV && "opacity-50")} aria-hidden /> Flip vertical
            </button>
          )}
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setFlipH(false); setFlipV(false); setErr(null); }} processLabel="Apply & render" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-ink-200/70 checker p-4 dark:border-ink-700/60">
            <img src={input.url} alt="Flip preview" style={{ transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})` }} className="max-h-[320px] max-w-full rounded object-contain shadow-sm transition-transform duration-200" />
          </div>
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Result" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Result appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Rounded corners ---------------- */

export function RoundedPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [radius, setRadius] = useState(12);
  const [pad, setPad] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const img = input.img;
      const W = img.naturalWidth + pad * 2, H = img.naturalHeight + pad * 2;
      const c = makeCanvas(W, H);
      const ctx = c.getContext("2d")!;
      roundedRectPath(ctx, 0, 0, W, H, radius);
      ctx.clip();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, pad, pad);
      const blob = await canvasToBlob(c, "image/png");
      out.set(blob, W, H);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Corners">
          <SliderControl label="Corner radius" value={radius} min={0} max={Math.min(400, Math.round((input.img ? Math.min(input.img.naturalWidth, input.img.naturalHeight) : 400) / 2))} unit="px" defaultValue={12} onChange={setRadius} />
          <SliderControl label="Outer padding" value={pad} min={0} max={200} unit="px" defaultValue={0} onChange={setPad} />
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold leading-relaxed text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
            Output is a transparent PNG — the rounded shape survives on any background.
          </p>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Round corners" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Rounded" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, "png")} label="Download PNG" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Rounded preview appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Border / Frame ---------------- */

export function BorderPanel({ tool }: { tool: Tool }) {
  const isFrame = Boolean(tool.config?.frame);
  const input = useImageInput();
  const out = useOutput();
  const [size, setSize] = useState(isFrame ? 48 : 24);
  const [color, setColor] = useState(isFrame ? "#ffffff" : "#0b1312");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const img = input.img;
      const W = img.naturalWidth + size * 2, H = img.naturalHeight + size * 2;
      const c = makeCanvas(W, H);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, size, size);
      if (isFrame) {
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = Math.max(1, Math.round(W / 900));
        ctx.strokeRect(size - ctx.lineWidth / 2, size - ctx.lineWidth / 2, img.naturalWidth + ctx.lineWidth, img.naturalHeight + ctx.lineWidth);
      }
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
      out.set(blob, W, H);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title={isFrame ? "Frame settings" : "Border settings"}>
          <SliderControl label={isFrame ? "Frame thickness" : "Border size"} value={size} min={2} max={300} unit="px" defaultValue={isFrame ? 48 : 24} onChange={setSize} />
          <ColorInput label={isFrame ? "Frame color" : "Border color"} value={color} onChange={setColor} />
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel={isFrame ? "Add frame" : "Add border"} />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} checker={false} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label={isFrame ? "Framed" : "Bordered"} width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} checker={false} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Result appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Shadow ---------------- */

export function ShadowPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [blur, setBlur] = useState(24);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(14);
  const [opacity, setOpacity] = useState(45);
  const [color, setColor] = useState("#0b1312");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const img = input.img;
      const pad = Math.round(blur * 2 + Math.max(Math.abs(offX), Math.abs(offY)) + 8);
      const W = img.naturalWidth + pad * 2, H = img.naturalHeight + pad * 2;
      const c = makeCanvas(W, H);
      const ctx = c.getContext("2d")!;
      ctx.shadowColor = color + Math.round(opacity * 2.55).toString(16).padStart(2, "0");
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = offX;
      ctx.shadowOffsetY = offY;
      ctx.drawImage(img, pad, pad);
      const blob = await canvasToBlob(c, "image/png");
      out.set(blob, W, H);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Shadow settings">
          <SliderControl label="Blur" value={blur} min={0} max={80} unit="px" defaultValue={24} onChange={setBlur} />
          <SliderControl label="Offset X" value={offX} min={-60} max={60} unit="px" defaultValue={0} onChange={setOffX} />
          <SliderControl label="Offset Y" value={offY} min={-60} max={60} unit="px" defaultValue={14} onChange={setOffY} />
          <SliderControl label="Opacity" value={opacity} min={0} max={100} unit="%" defaultValue={45} onChange={setOpacity} />
          <ColorInput label="Shadow color" value={color} onChange={setColor} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Add shadow" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="With shadow" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, "png")} label="Download PNG" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Shadow preview appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

export { formatBytes, percentSaved };
