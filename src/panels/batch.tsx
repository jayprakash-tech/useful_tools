import { useState } from "react";
import type { Tool } from "../lib/types";
import {
  canvasToBlob, clamp, formatBytes, loadImageFromFile, makeCanvas, percentSaved, replaceExt,
  roundedRectPath, scaleImage,
} from "../lib/image";
import { useBatch, BatchList, ControlsCard, ToolGrid, ActionRow, errMsg } from "./state";
import { FileDropzone } from "../components/shared";
import { ColorInput, Field, Select, SliderControl, TextInput, Toggle } from "../components/ui";

const FORMAT_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

/* ---------------- Batch resize ---------------- */

export function BatchResizePanel({ tool }: { tool: Tool }) {
  const batch = useBatch();
  const [mode, setMode] = useState("width");
  const [value, setValue] = useState("1200");
  const [format, setFormat] = useState("image/jpeg");

  const process = () =>
    batch.run(async (item) => {
      const img = await loadImageFromFile(item.file);
      const v = clamp(parseInt(value, 10) || 1200, 1, 6000);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (mode === "width") { w = v; h = Math.round((v * img.naturalHeight) / img.naturalWidth); }
      else if (mode === "height") { h = v; w = Math.round((v * img.naturalWidth) / img.naturalHeight); }
      else { const f = v / 100; w = Math.max(1, Math.round(w * f)); h = Math.max(1, Math.round(h * f)); }
      const c = scaleImage(img, img.naturalWidth, img.naturalHeight, w, h);
      if (format === "image/jpeg") {
        const tmp = makeCanvas(c.width, c.height);
        const tctx = tmp.getContext("2d")!;
        tctx.fillStyle = "#fff"; tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(c, 0, 0);
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(tmp, 0, 0);
      }
      const blob = await canvasToBlob(c, format, 0.9);
      return { blob, name: replaceExt(item.file.name, FORMAT_EXT[format]), note: `${c.width}×${c.height}` };
    });

  return (
    <div className="space-y-6">
      <FileDropzone accept={tool.accept} multiple onFiles={batch.addFiles} title="Drop images to resize" />
      {batch.items.length > 0 && (
        <ToolGrid
          controls={
            <ControlsCard title="Resize rule">
              <Field label="Mode">
                <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="width">Fixed width</option>
                  <option value="height">Fixed height</option>
                  <option value="percent">Percentage</option>
                </Select>
              </Field>
              <Field label={mode === "percent" ? "Percent" : "Pixels"}>
                <TextInput inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} placeholder={mode === "percent" ? "50" : "1200"} />
              </Field>
              <Field label="Output format">
                <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WEBP</option>
                </Select>
              </Field>
              <ActionRow hasInput busy={batch.running} onProcess={process} onReset={batch.clear} processLabel={`Resize ${batch.items.length} image${batch.items.length > 1 ? "s" : ""}`} />
            </ControlsCard>
          }
        >
          <BatchList batch={batch} zipName="resized-images.zip" />
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Batch convert ---------------- */

export function BatchConvertPanel({ tool }: { tool: Tool }) {
  const batch = useBatch();
  const [format, setFormat] = useState("image/webp");
  const [quality, setQuality] = useState(85);
  const [bg, setBg] = useState("#ffffff");

  const process = () =>
    batch.run(async (item) => {
      const img = await loadImageFromFile(item.file);
      const c = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext("2d")!;
      if (format === "image/jpeg") { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : quality / 100);
      return { blob, name: replaceExt(item.file.name, FORMAT_EXT[format]), note: formatBytes(blob.size) };
    });

  return (
    <div className="space-y-6">
      <FileDropzone accept={tool.accept} multiple onFiles={batch.addFiles} title="Drop images to convert" />
      {batch.items.length > 0 && (
        <ToolGrid
          controls={
            <ControlsCard title="Conversion">
              <Field label="Output format">
                <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WEBP</option>
                </Select>
              </Field>
              {format !== "image/png" && <SliderControl label="Quality" value={quality} min={10} max={100} unit="%" defaultValue={85} onChange={setQuality} />}
              {format === "image/jpeg" && <ColorInput label="Transparency fill" value={bg} onChange={setBg} />}
              <ActionRow hasInput busy={batch.running} onProcess={process} onReset={batch.clear} processLabel={`Convert ${batch.items.length} file${batch.items.length > 1 ? "s" : ""}`} />
            </ControlsCard>
          }
        >
          <BatchList batch={batch} zipName="converted-images.zip" />
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Batch rename ---------------- */

export function BatchRenamePanel({ tool }: { tool: Tool }) {
  const batch = useBatch();
  const [prefix, setPrefix] = useState("photo");
  const [padding, setPadding] = useState("3");
  const [start, setStart] = useState("1");

  const process = () =>
    batch.run(async (item) => {
      const idx = batch.items.findIndex((i) => i.id === item.id);
      const num = String((parseInt(start, 10) || 1) + idx).padStart(parseInt(padding, 10) || 3, "0");
      const ext = item.file.name.includes(".") ? `.${item.file.name.split(".").pop()}` : "";
      const name = `${prefix.trim() || "file"}-${num}${ext}`;
      return { blob: item.file, name, note: "renamed" };
    });

  const previewName = (idx: number) => {
    const num = String((parseInt(start, 10) || 1) + idx).padStart(parseInt(padding, 10) || 3, "0");
    return `${prefix.trim() || "file"}-${num}`;
  };

  return (
    <div className="space-y-6">
      <FileDropzone accept={tool.accept} multiple onFiles={batch.addFiles} title="Drop images to rename" />
      {batch.items.length > 0 && (
        <ToolGrid
          controls={
            <ControlsCard title="Naming pattern">
              <Field label="Prefix"><TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="photo" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Number padding">
                  <Select value={padding} onChange={(e) => setPadding(e.target.value)}>
                    <option value="2">01, 02…</option>
                    <option value="3">001, 002…</option>
                    <option value="4">0001, 0002…</option>
                  </Select>
                </Field>
                <Field label="Start at"><TextInput inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, ""))} /></Field>
              </div>
              <p className="rounded-lg bg-brand-50 px-3 py-2 font-mono text-xs font-bold text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
                {previewName(0)} … {previewName(Math.max(0, batch.items.length - 1))}
              </p>
              <ActionRow hasInput busy={batch.running} onProcess={process} onReset={batch.clear} processLabel="Apply names & prepare ZIP" />
            </ControlsCard>
          }
        >
          <BatchList batch={batch} zipName="renamed-images.zip" />
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Batch rounded corners ---------------- */

export function BatchRoundedPanel({ tool }: { tool: Tool }) {
  const batch = useBatch();
  const [radius, setRadius] = useState(24);

  const process = () =>
    batch.run(async (item) => {
      const img = await loadImageFromFile(item.file);
      const c = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext("2d")!;
      roundedRectPath(ctx, 0, 0, c.width, c.height, radius);
      ctx.clip();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0);
      const blob = await canvasToBlob(c, "image/png");
      return { blob, name: replaceExt(item.file.name, "png"), note: `${radius}px radius` };
    });

  return (
    <div className="space-y-6">
      <FileDropzone accept={tool.accept} multiple onFiles={batch.addFiles} title="Drop images to round" />
      {batch.items.length > 0 && (
        <ToolGrid
          controls={
            <ControlsCard title="Corner radius">
              <SliderControl label="Radius" value={radius} min={0} max={200} unit="px" defaultValue={24} onChange={setRadius} />
              <p className="text-xs leading-relaxed text-ink-500">Outputs transparent PNGs so the rounded shape survives on any background.</p>
              <ActionRow hasInput busy={batch.running} onProcess={process} onReset={batch.clear} processLabel={`Round ${batch.items.length} image${batch.items.length > 1 ? "s" : ""}`} />
            </ControlsCard>
          }
        >
          <BatchList batch={batch} zipName="rounded-images.zip" />
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- Batch watermark ---------------- */

export function BatchWatermarkPanel({ tool }: { tool: Tool }) {
  const batch = useBatch();
  const [text, setText] = useState("© My Brand");
  const [size, setSize] = useState(40);
  const [color, setColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(40);
  const [pos, setPos] = useState("bottom-right");
  const [tile, setTile] = useState(false);
  const [format, setFormat] = useState("image/jpeg");

  const draw = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    if (!text.trim()) return;
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px Manrope, sans-serif`;
    if (tile) {
      const gap = size * 7;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 6);
      const span = Math.hypot(W, H);
      for (let y = -span; y < span; y += gap)
        for (let x = -span; x < span; x += gap * 1.4) ctx.fillText(text, x, y);
      ctx.restore();
    } else {
      const m = size * 0.7;
      let x = m, y = m;
      ctx.textBaseline = "top";
      if (pos.includes("right")) { ctx.textAlign = "right"; x = W - m; } else ctx.textAlign = "left";
      if (pos === "top" || pos === "bottom") { ctx.textAlign = "center"; x = W / 2; }
      if (pos.includes("bottom")) y = H - m - size;
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
  };

  const process = () =>
    batch.run(async (item) => {
      const img = await loadImageFromFile(item.file);
      const c = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext("2d")!;
      if (format === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0);
      draw(ctx, c.width, c.height);
      const blob = await canvasToBlob(c, format, format === "image/png" ? undefined : 0.9);
      return { blob, name: replaceExt(item.file.name, FORMAT_EXT[format]), note: "watermarked" };
    });

  return (
    <div className="space-y-6">
      <FileDropzone accept={tool.accept} multiple onFiles={batch.addFiles} title="Drop images to watermark" />
      {batch.items.length > 0 && (
        <ToolGrid
          controls={
            <ControlsCard title="Watermark">
              <Field label="Text"><TextInput value={text} onChange={(e) => setText(e.target.value)} /></Field>
              <SliderControl label="Font size" value={size} min={12} max={160} unit="px" defaultValue={40} onChange={setSize} />
              <ColorInput label="Color" value={color} onChange={setColor} />
              <SliderControl label="Opacity" value={opacity} min={5} max={100} unit="%" defaultValue={40} onChange={setOpacity} />
              <Toggle label="Tiled mode" checked={tile} onChange={setTile} />
              {!tile && (
                <Field label="Position">
                  <Select value={pos} onChange={(e) => setPos(e.target.value)}>
                    <option value="top-left">Top left</option><option value="top">Top</option><option value="top-right">Top right</option>
                    <option value="bottom-left">Bottom left</option><option value="bottom">Bottom</option><option value="bottom-right">Bottom right</option>
                  </Select>
                </Field>
              )}
              <Field label="Output format">
                <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WEBP</option>
                </Select>
              </Field>
              <ActionRow hasInput busy={batch.running} onProcess={process} onReset={batch.clear} processLabel={`Watermark ${batch.items.length} image${batch.items.length > 1 ? "s" : ""}`} disabled={!text.trim()} />
            </ControlsCard>
          }
        >
          <BatchList batch={batch} zipName="watermarked-images.zip" />
        </ToolGrid>
      )}
    </div>
  );
}
