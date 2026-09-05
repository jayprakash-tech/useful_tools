import { useEffect, useRef, useState } from "react";
import type { Tool } from "../lib/types";
import { canvasToBlob, clamp, hexToRgb, loadImageFromFile, luminance, makeCanvas, replaceExt, roundedRectPath } from "../lib/image";
import { useImageInput, useOutput, ControlsCard, ToolGrid, ActionRow, errMsg } from "./state";
import { FileDropzone, ImagePreview, DownloadButton } from "../components/shared";
import { Alert, ColorInput, Field, Select, SliderControl, TextInput, Toggle } from "../components/ui";

const FORMAT_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

/** Debounced canvas preview. draw receives ctx, W, H and a scale factor. */
function useCanvasPreview(
  img: HTMLImageElement | null,
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number, s: number) => void,
  deps: unknown[],
) {
  const [url, setUrl] = useState<string | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    if (!img) { setUrl(null); return; }
    const t = setTimeout(() => {
      const maxW = 720;
      const s = Math.min(1, maxW / img.naturalWidth);
      const c = makeCanvas(img.naturalWidth * s, img.naturalHeight * s);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      drawRef.current(ctx, c.width, c.height, s);
      setUrl(c.toDataURL("image/png"));
    }, 120);
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

function renderFull(img: HTMLImageElement, draw: (ctx: CanvasRenderingContext2D, W: number, H: number, s: number) => void, format: string) {
  const c = makeCanvas(img.naturalWidth, img.naturalHeight);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  draw(ctx, c.width, c.height, 1);
  return canvasToBlob(c, format, format === "image/png" ? undefined : 0.92);
}

const POSITIONS = [
  ["top-left", "↖ Top left"], ["top", "↑ Top"], ["top-right", "↗ Top right"],
  ["left", "← Left"], ["center", "• Center"], ["right", "→ Right"],
  ["bottom-left", "↙ Bottom left"], ["bottom", "↓ Bottom"], ["bottom-right", "↘ Bottom right"],
] as const;

function positionXY(pos: string, W: number, H: number, margin: number): [number, number, CanvasTextAlign, CanvasTextBaseline] {
  const m = margin;
  const cx = W / 2, cy = H / 2;
  switch (pos) {
    case "top-left": return [m, m, "left", "top"];
    case "top": return [cx, m, "center", "top"];
    case "top-right": return [W - m, m, "right", "top"];
    case "left": return [m, cy, "left", "middle"];
    case "center": return [cx, cy, "center", "middle"];
    case "right": return [W - m, cy, "right", "middle"];
    case "bottom-left": return [m, H - m, "left", "bottom"];
    case "bottom": return [cx, H - m, "center", "bottom"];
    default: return [W - m, H - m, "right", "bottom"];
  }
}

/* ---------------- Text watermark ---------------- */

export function WmTextPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [text, setText] = useState("© ClearImageTools");
  const [size, setSize] = useState(48);
  const [color, setColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(35);
  const [pos, setPos] = useState("bottom-right");
  const [tile, setTile] = useState(false);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const draw = (ctx: CanvasRenderingContext2D, W: number, H: number, s: number) => {
    if (!text.trim()) return;
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    const fs = size * s;
    ctx.font = `700 ${fs}px Manrope, sans-serif`;
    if (tile) {
      const gap = fs * 7;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 6);
      const span = Math.hypot(W, H);
      for (let y = -span; y < span; y += gap)
        for (let x = -span; x < span; x += gap * 1.4) ctx.fillText(text, x, y);
      ctx.restore();
    } else {
      const [x, y, align, base] = positionXY(pos, W, H, fs * 0.7);
      ctx.textAlign = align;
      ctx.textBaseline = base;
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
  };

  const preview = useCanvasPreview(input.img, draw, [text, size, color, opacity, pos, tile]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const blob = await renderFull(input.img, draw, format);
      out.set(blob, input.img.naturalWidth, input.img.naturalHeight);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Watermark">
          <Field label="Watermark text">
            <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="© Your Name 2025" />
          </Field>
          <SliderControl label="Font size" value={size} min={12} max={200} unit="px" defaultValue={48} onChange={setSize} />
          <ColorInput label="Color" value={color} onChange={setColor} />
          <SliderControl label="Opacity" value={opacity} min={5} max={100} unit="%" defaultValue={35} onChange={setOpacity} />
          <Toggle label="Tiled diagonal watermark" checked={tile} onChange={setTile} />
          {!tile && (
            <Field label="Position">
              <Select value={pos} onChange={(e) => setPos(e.target.value)}>
                {POSITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
          )}
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Add watermark" disabled={!text.trim()} />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={preview ?? input.url} label="Live preview" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Watermarked (full res)" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download watermarked image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Watermarked result appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Logo watermark ---------------- */

export function WmImagePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [logoName, setLogoName] = useState("");
  const [scalePct, setScalePct] = useState(18);
  const [pos, setPos] = useState("bottom-right");
  const [opacity, setOpacity] = useState(85);
  const [format, setFormat] = useState("image/png");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [logoErr, setLogoErr] = useState<string | null>(null);

  const loadLogo = async (f: File) => {
    setLogoErr(null);
    try {
      setLogo(await loadImageFromFile(f));
      setLogoName(f.name);
    } catch (e) { setLogoErr(errMsg(e)); }
  };

  const draw = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    if (!logo) return;
    const lw = (W * scalePct) / 100;
    const lh = lw * (logo.naturalHeight / logo.naturalWidth);
    const m = W * 0.03;
    let x = m, y = m;
    if (pos.includes("right")) x = W - lw - m;
    if (pos === "center" || pos === "top" || pos === "bottom") x = (W - lw) / 2;
    if (pos.includes("bottom")) y = H - lh - m;
    if (pos === "center" || pos === "left" || pos === "right") y = (H - lh) / 2;
    ctx.globalAlpha = opacity / 100;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, x, y, lw, lh);
    ctx.globalAlpha = 1;
  };

  const preview = useCanvasPreview(input.img, draw, [logo, scalePct, pos, opacity]);

  const process = async () => {
    if (!input.img || !input.file || !logo) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const blob = await renderFull(input.img, draw, format);
      out.set(blob, input.img.naturalWidth, input.img.naturalHeight);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} title="1 · Drop the main image" />
        <div className="space-y-2">
          <FileDropzone accept="image/*" onFiles={(f) => loadLogo(f[0])} title="2 · Drop your logo" subtitle="PNG with transparency works best — or" />
          {logoName && <p className="text-xs font-bold text-emerald-600">✓ Logo loaded: {logoName}</p>}
          {logoErr && <Alert tone="error">{logoErr}</Alert>}
        </div>
      </div>
      {input.url && input.img && (
        <ToolGrid
          controls={
            <ControlsCard title="Logo placement">
              <SliderControl label="Logo width" value={scalePct} min={5} max={60} unit="%" defaultValue={18} onChange={setScalePct} />
              <SliderControl label="Opacity" value={opacity} min={5} max={100} unit="%" defaultValue={85} onChange={setOpacity} />
              <Field label="Position">
                <Select value={pos} onChange={(e) => setPos(e.target.value)}>
                  {POSITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
              <FormatSelect value={format} onChange={setFormat} />
              <ActionRow hasInput={Boolean(input.img && logo)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Stamp logo" />
            </ControlsCard>
          }
        >
          {err && <Alert tone="error">{err}</Alert>}
          <div className="grid gap-5 md:grid-cols-2">
            <ImagePreview src={preview ?? input.url} label="Live preview" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
            {out.url ? (
              <div className="space-y-4">
                <ImagePreview src={out.url} label="Result (full res)" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
                <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download image" />
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Result appears here</div>
            )}
          </div>
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Text on image (draggable) ---------------- */

export function TextOnImagePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [text, setText] = useState("Your caption here");
  const [size, setSize] = useState(64);
  const [color, setColor] = useState("#ffffff");
  const [strokeW, setStrokeW] = useState(4);
  const [strokeColor, setStrokeColor] = useState("#0b1312");
  const [opacity, setOpacity] = useState(100);
  const [rxy, setRxy] = useState<[number, number]>([0.5, 0.85]);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const draw = (ctx: CanvasRenderingContext2D, W: number, H: number, s: number) => {
    if (!text.trim()) return;
    const fs = size * s;
    ctx.font = `800 ${fs}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = opacity / 100;
    const x = rxy[0] * W, y = rxy[1] * H;
    const lines = text.split("\n");
    const lh = fs * 1.25;
    lines.forEach((line, i) => {
      const ly = y + (i - (lines.length - 1) / 2) * lh;
      if (strokeW > 0) {
        ctx.lineWidth = strokeW * s;
        ctx.strokeStyle = strokeColor;
        ctx.lineJoin = "round";
        ctx.strokeText(line, x, ly);
      }
      ctx.fillStyle = color;
      ctx.fillText(line, x, ly);
    });
    ctx.globalAlpha = 1;
  };

  const preview = useCanvasPreview(input.img, draw, [text, size, color, strokeW, strokeColor, opacity, rxy]);

  const onPointer = (e: React.PointerEvent) => {
    const el = dragRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      setRxy([clamp((ev.clientX - rect.left) / rect.width, 0.02, 0.98), clamp((ev.clientY - rect.top) / rect.height, 0.02, 0.98)]);
    };
    move(e.nativeEvent);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const blob = await renderFull(input.img, draw, format);
      out.set(blob, input.img.naturalWidth, input.img.naturalHeight);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Text style">
          <Field label="Text" hint="Line breaks create multiple lines.">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="focus-ring w-full rounded-lg border border-ink-200 bg-white p-3 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
          </Field>
          <SliderControl label="Font size" value={size} min={16} max={240} unit="px" defaultValue={64} onChange={setSize} />
          <ColorInput label="Text color" value={color} onChange={setColor} />
          <SliderControl label="Outline width" value={strokeW} min={0} max={20} unit="px" defaultValue={4} onChange={setStrokeW} />
          {strokeW > 0 && <ColorInput label="Outline color" value={strokeColor} onChange={setStrokeColor} />}
          <SliderControl label="Opacity" value={opacity} min={10} max={100} unit="%" defaultValue={100} onChange={setOpacity} />
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Render text" disabled={!text.trim()} />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold text-ink-500">Tip: drag directly on the image to position the text.</p>
            <div ref={dragRef} onPointerDown={onPointer} className="checker cursor-move touch-none overflow-hidden rounded-xl border border-ink-200/70 dark:border-ink-700/60">
              <img src={preview ?? input.url} alt="Draggable text preview" className="mx-auto max-h-[420px] select-none object-contain" draggable={false} />
            </div>
          </div>
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Final image (full res)" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download image" />
            </div>
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Full-resolution result appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Meme generator ---------------- */

export function MemePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const [sizePct, setSizePct] = useState(9);
  const [color, setColor] = useState("#ffffff");
  const [outline, setOutline] = useState("#000000");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const drawMeme = (ctx: CanvasRenderingContext2D, W: number, H: number, s: number) => {
    const fs = Math.max(14, (W * sizePct) / 100);
    ctx.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = fs / 10;
    ctx.lineJoin = "round";
    const maxW = W * 0.92;
    const wrap = (txt: string) => {
      const words = txt.toUpperCase().split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    };
    const strokeFill = (line: string, x: number, y: number) => {
      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
    };
    if (top.trim()) {
      const lines = wrap(top);
      lines.forEach((l, i) => strokeFill(l, W / 2, fs * 1.15 + i * fs * 1.12));
    }
    if (bottom.trim()) {
      const lines = wrap(bottom);
      [...lines].reverse().forEach((l, i) => strokeFill(l, W / 2, H - fs * 0.9 - i * fs * 1.12));
    }
  };

  const preview = useCanvasPreview(input.img, drawMeme, [top, bottom, sizePct, color, outline]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const blob = await renderFull(input.img, drawMeme, format);
      out.set(blob, input.img.naturalWidth, input.img.naturalHeight);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Meme text">
          <Field label="Top text"><TextInput value={top} onChange={(e) => setTop(e.target.value)} placeholder="WHEN YOU FINALLY" /></Field>
          <Field label="Bottom text"><TextInput value={bottom} onChange={(e) => setBottom(e.target.value)} placeholder="COMPRESS THE PHOTOS" /></Field>
          <SliderControl label="Text size" value={sizePct} min={4} max={16} unit="%" defaultValue={9} onChange={setSizePct} />
          <ColorInput label="Text color" value={color} onChange={setColor} />
          <ColorInput label="Outline color" value={outline} onChange={setOutline} />
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Generate meme" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} title="Drop a template image" />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={preview ?? input.url} label="Live meme preview" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} checker={false} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Your meme" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} checker={false} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download meme" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">Finished meme appears here</div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- Badge adder ---------------- */

export function BadgePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const [label, setLabel] = useState("NEW");
  const [color, setColor] = useState("#e11d48");
  const [pos, setPos] = useState("top-right");
  const [shape, setShape] = useState("pill");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const draw = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    if (!label.trim()) return;
    const fs = clamp(W * 0.05, 18, 96);
    ctx.font = `800 ${fs}px Manrope, sans-serif`;
    const tw = ctx.measureText(label.toUpperCase()).width;
    const padX = fs * 0.9, padY = fs * 0.5;
    const bw = tw + padX * 2, bh = fs + padY * 2;
    const m = W * 0.035;
    let x = m, y = m;
    if (pos === "top-right") x = W - bw - m;
    if (pos === "bottom-left") y = H - bh - m;
    if (pos === "bottom-right") { x = W - bw - m; y = H - bh - m; }
    const [cr, cg, cb] = hexToRgb(color);
    roundedRectPath(ctx, x, y, bw, bh, shape === "pill" ? bh / 2 : fs * 0.25);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = luminance(cr, cg, cb) > 140 ? "#0b1312" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.toUpperCase(), x + bw / 2, y + bh / 2 + fs * 0.05);
  };

  const preview = useCanvasPreview(input.img, draw, [label, color, pos, shape]);

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const blob = await renderFull(input.img, draw, format);
      out.set(blob, input.img.naturalWidth, input.img.naturalHeight);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Badge">
          <Field label="Badge text" hint="Short labels (1–12 characters) work best.">
            <TextInput value={label} maxLength={16} onChange={(e) => setLabel(e.target.value)} placeholder="SALE" />
          </Field>
          <ColorInput label="Badge color" value={color} onChange={setColor} />
          <Field label="Position">
            <Select value={pos} onChange={(e) => setPos(e.target.value)}>
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
            </Select>
          </Field>
          <Field label="Shape">
            <Select value={shape} onChange={(e) => setShape(e.target.value)}>
              <option value="pill">Pill</option>
              <option value="rect">Rectangle</option>
            </Select>
          </Field>
          <FormatSelect value={format} onChange={setFormat} />
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Add badge" disabled={!label.trim()} />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={preview ?? input.url} label="Live preview" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Result (full res)" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
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
