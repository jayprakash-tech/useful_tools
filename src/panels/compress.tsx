import { useState } from "react";
import imageCompression from "browser-image-compression";
import type { Tool } from "../lib/types";
import { canvasToBlob, clamp, formatBytes, loadImageFromFile, percentSaved, replaceExt, scaleImage } from "../lib/image";
import { useImageInput, useOutput, ControlsCard, ToolGrid, ActionRow, errMsg, useBatch, BatchList } from "./state";
import { FileDropzone, ImagePreview, DownloadButton, Stat } from "../components/shared";
import { Alert, Button, Field, Select, SliderControl, TextInput, useToast } from "../components/ui";

const FORMAT_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

export function CompressorPanel({ tool }: { tool: Tool }) {
  const qualityOnly = Boolean(tool.config?.qualityOnly);
  const input = useImageInput();
  const out = useOutput();
  const toast = useToast();
  const [quality, setQuality] = useState(80);
  const [maxDim, setMaxDim] = useState("");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const process = async () => {
    if (!input.file) return;
    setBusy(true);
    setWarn(null);
    out.reset();
    try {
      const maxW = parseInt(maxDim, 10);
      const result = await imageCompression(input.file, {
        maxSizeMB: 50,
        maxWidthOrHeight: qualityOnly ? undefined : Number.isFinite(maxW) && maxW > 0 ? clamp(maxW, 8, 8000) : undefined,
        initialQuality: quality / 100,
        fileType: format,
        useWebWorker: true,
        preserveExif: false,
      });
      if (result.size >= input.file.size) {
        setWarn("The result is not smaller than the original at these settings. Try a lower quality or a size limit.");
      }
      const img = await loadImageFromFile(result);
      out.set(result, img.naturalWidth, img.naturalHeight);
      toast(`Compressed to ${formatBytes(result.size)}`);
    } catch (e) {
      setWarn(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { input.reset(); out.reset(); setWarn(null); };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Compression settings">
          <SliderControl label="Quality" value={quality} min={1} max={100} unit="%" defaultValue={80} onChange={setQuality} />
          {!qualityOnly && (
            <Field label="Max width or height (px)" hint="Leave empty to keep original dimensions.">
              <TextInput inputMode="numeric" placeholder="e.g. 1920" value={maxDim} onChange={(e) => setMaxDim(e.target.value.replace(/\D/g, ""))} />
            </Field>
          )}
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/jpeg">JPG — best for photos</option>
              <option value="image/webp">WEBP — smallest files</option>
              {!qualityOnly && <option value="image/png">PNG — lossless</option>}
            </Select>
          </Field>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={reset} processLabel="Compress image" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.loading && <Alert tone="info">Reading image…</Alert>}
      {input.error && <Alert tone="error">{input.error} <Button variant="ghost" className="ml-2 px-2 py-1" onClick={reset}>Try another</Button></Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Compressed" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Before" value={formatBytes(input.file!.size)} />
                <Stat label="After" value={formatBytes(out.blob!.size)} />
                <Stat label="Saved" value={percentSaved(input.file!.size, out.blob!.size)} tone={out.blob!.size < input.file!.size ? "ok" : undefined} />
              </div>
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format] ?? "jpg")} label="Download compressed image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
              Compressed preview appears here
            </div>
          )}
        </div>
      )}
      {warn && <Alert tone="warn">{warn}</Alert>}
    </ToolGrid>
  );
}

export function TargetSizePanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const toast = useToast();
  const [targetKB, setTargetKB] = useState("200");
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const process = async () => {
    if (!input.img || !input.file) return;
    const target = parseInt(targetKB, 10);
    if (!Number.isFinite(target) || target < 5) { setWarn("Enter a target size of at least 5 KB."); return; }
    setBusy(true); setWarn(null); out.reset();
    try {
      const targetBytes = target * 1024;
      const img = input.img;
      // cap working resolution for speed
      const cap = 2400;
      const baseScale = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight));
      let scale = baseScale;
      let best: Blob | null = null;
      for (let round = 0; round < 5; round++) {
        const w = Math.max(16, img.naturalWidth * scale);
        const h = Math.max(16, img.naturalHeight * scale);
        const canvas = scaleImage(img, img.naturalWidth, img.naturalHeight, w, h);
        let lo = 0.04, hi = 0.95, local: Blob | null = null;
        for (let i = 0; i < 6; i++) {
          const q = (lo + hi) / 2;
          const blob = await canvasToBlob(canvas, format, q);
          local = blob;
          if (blob.size > targetBytes) hi = q; else lo = q;
        }
        if (local) best = local;
        if (best && best.size <= targetBytes * 1.06) break;
        if (best && scale > 0.12) scale *= Math.max(0.35, Math.sqrt(targetBytes / best.size) * 0.92);
        else break;
      }
      if (!best) throw new Error("Could not encode this image.");
      if (best.size > targetBytes * 1.15) setWarn(`Reached ${formatBytes(best.size)} — very dense images cannot always hit aggressive targets. Result is approximate.`);
      const check = await loadImageFromFile(best);
      out.set(best, check.naturalWidth, check.naturalHeight);
      toast(`Compressed to ${formatBytes(best.size)} (target ${target} KB)`);
    } catch (e) {
      setWarn(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Target size">
          <Field label="Target size (KB)" hint="The tool searches for the best quality near this size.">
            <TextInput inputMode="numeric" value={targetKB} onChange={(e) => setTargetKB(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 200" />
          </Field>
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WEBP</option>
            </Select>
          </Field>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Result size is approximate — image content determines how far compression can go.
          </p>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setWarn(null); }} processLabel="Compress to target" />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Result" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Before" value={formatBytes(input.file!.size)} />
                <Stat label="After" value={formatBytes(out.blob!.size)} />
                <Stat label="Target" value={`${targetKB} KB`} tone="ok" />
              </div>
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
              Result appears here
            </div>
          )}
        </div>
      )}
      {warn && <Alert tone="warn">{warn}</Alert>}
    </ToolGrid>
  );
}

export function ResizeCompressPanel({ tool }: { tool: Tool }) {
  const input = useImageInput();
  const out = useOutput();
  const toast = useToast();
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lock, setLock] = useState(true);
  const [quality, setQuality] = useState(85);
  const [format, setFormat] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onWidth = (v: string) => {
    setWidth(v);
    if (lock && input.img && v) setHeight(String(Math.round((parseInt(v, 10) * input.img.naturalHeight) / input.img.naturalWidth)));
  };
  const onHeight = (v: string) => {
    setHeight(v);
    if (lock && input.img && v) setWidth(String(Math.round((parseInt(v, 10) * input.img.naturalWidth) / input.img.naturalHeight)));
  };

  const process = async () => {
    if (!input.img || !input.file) return;
    const w = parseInt(width, 10), h = parseInt(height, 10);
    if (!w || !h || w < 1 || h < 1) { setErr("Enter a valid width and height (at least 1 px)."); return; }
    setErr(null); setBusy(true); out.reset();
    try {
      const canvas = scaleImage(input.img, input.img.naturalWidth, input.img.naturalHeight, w, h);
      if (format !== "image/png") {
        const ctx = canvas.getContext("2d")!;
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width; tmp.height = canvas.height;
        const tctx = tmp.getContext("2d")!;
        tctx.fillStyle = "#ffffff";
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0);
      }
      const blob = await canvasToBlob(canvas, format, quality / 100);
      out.set(blob, canvas.width, canvas.height);
      toast("Resize + compression complete");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Resize & compress">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width (px)"><TextInput inputMode="numeric" value={width} onChange={(e) => onWidth(e.target.value.replace(/\D/g, ""))} placeholder="1200" /></Field>
            <Field label="Height (px)"><TextInput inputMode="numeric" value={height} onChange={(e) => onHeight(e.target.value.replace(/\D/g, ""))} placeholder="800" /></Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink-700 dark:text-ink-200">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Maintain aspect ratio
          </label>
          <SliderControl label="Quality" value={quality} min={1} max={100} unit="%" defaultValue={85} onChange={setQuality} />
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WEBP</option>
              <option value="image/png">PNG</option>
            </Select>
          </Field>
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel="Resize & compress" />
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
              <ImagePreview src={out.url} label="Optimized" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Original" value={formatBytes(input.file!.size)} />
                <Stat label="Optimized" value={`${formatBytes(out.blob!.size)} (${percentSaved(input.file!.size, out.blob!.size)})`} tone="ok" />
              </div>
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, FORMAT_EXT[format])} label="Download optimized image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
              Optimized preview appears here
            </div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

export function BatchCompressorPanel({ tool }: { tool: Tool }) {
  const batch = useBatch();
  const [quality, setQuality] = useState(75);
  const [maxDim, setMaxDim] = useState("");
  const [format, setFormat] = useState("image/jpeg");

  const process = () =>
    batch.run(async (item) => {
      const maxW = parseInt(maxDim, 10);
      const result = await imageCompression(item.file, {
        maxSizeMB: 50,
        maxWidthOrHeight: Number.isFinite(maxW) && maxW > 0 ? clamp(maxW, 8, 8000) : undefined,
        initialQuality: quality / 100,
        fileType: format,
        useWebWorker: true,
        preserveExif: false,
      });
      return {
        blob: result,
        name: replaceExt(item.file.name, FORMAT_EXT[format]),
        note: `${formatBytes(result.size)} (−${percentSaved(item.file.size, result.size)})`,
      };
    });

  return (
    <div className="space-y-6">
      <FileDropzone accept={tool.accept} multiple onFiles={batch.addFiles} title="Drop images here" subtitle="Add as many as you like — or" />
      {batch.items.length > 0 && (
        <ToolGrid
          controls={
            <ControlsCard title="Batch settings">
              <SliderControl label="Quality" value={quality} min={1} max={100} unit="%" defaultValue={75} onChange={setQuality} />
              <Field label="Max width or height (px)" hint="Optional — applied to every image.">
                <TextInput inputMode="numeric" placeholder="e.g. 1600" value={maxDim} onChange={(e) => setMaxDim(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Output format">
                <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/webp">WEBP</option>
                  <option value="image/png">PNG</option>
                </Select>
              </Field>
              <ActionRow hasInput={batch.items.length > 0} busy={batch.running} onProcess={process} onReset={batch.clear} processLabel={`Compress ${batch.items.length} image${batch.items.length > 1 ? "s" : ""}`} />
            </ControlsCard>
          }
        >
          <BatchList batch={batch} zipName="compressed-images.zip" />
        </ToolGrid>
      )}
    </div>
  );
}
