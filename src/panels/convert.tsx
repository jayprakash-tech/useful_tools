import { useEffect, useMemo, useRef, useState } from "react";
import type { Tool } from "../lib/types";
import {
  canvasToBlob, downloadBlob, fileToDataUrl, formatBytes, makeCanvas, makeZip, rasterizeSvg,
  replaceExt, scaleImage, blobUrl,
} from "../lib/image";
import { useImageInput, useOutput, ControlsCard, ToolGrid, ActionRow, errMsg, useBatch, BatchList } from "./state";
import { FileDropzone, ImagePreview, DownloadButton, Stat } from "../components/shared";
import { Alert, Button, ColorInput, CopyButton, Field, Select, SliderControl, TextInput, useToast } from "../components/ui";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

const MIME_OUT: Record<string, { mime: string; ext: string }> = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
};

/* ---------------- generic converter ---------------- */

export function ConvertPanel({ tool }: { tool: Tool }) {
  const cfg = tool.config ?? {};
  const input = useImageInput();
  const out = useOutput();
  const toast = useToast();
  const [outKey, setOutKey] = useState<string>(cfg.out ?? "jpeg");
  const [quality, setQuality] = useState(90);
  const [bg, setBg] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showQuality = Boolean(cfg.quality) || Boolean(cfg.choose) && outKey !== "png";
  const showBg = (Boolean(cfg.bg) || Boolean(cfg.choose)) && outKey === "jpeg";

  const process = async () => {
    if (!input.img || !input.file) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const { mime, ext } = MIME_OUT[outKey];
      const c = makeCanvas(input.img.naturalWidth, input.img.naturalHeight);
      const ctx = c.getContext("2d")!;
      if (mime === "image/jpeg") { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(input.img, 0, 0);
      const blob = await canvasToBlob(c, mime, mime === "image/png" ? undefined : quality / 100);
      out.set(blob, c.width, c.height);
      toast(`Converted to ${ext.toUpperCase()}`);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Conversion">
          {cfg.choose && (
            <Field label="Output format">
              <Select value={outKey} onChange={(e) => setOutKey(e.target.value)}>
                <option value="jpeg">JPG — small, universal</option>
                <option value="png">PNG — lossless, transparency</option>
                <option value="webp">WEBP — modern, tiny</option>
              </Select>
            </Field>
          )}
          {showQuality && <SliderControl label="Quality" value={quality} min={10} max={100} unit="%" defaultValue={90} onChange={setQuality} />}
          {showBg && (
            <>
              <ColorInput label="Background for transparent areas" value={bg} onChange={setBg} />
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                JPG cannot store transparency — transparent pixels will be filled with this color.
              </p>
            </>
          )}
          <ActionRow hasInput={Boolean(input.img)} busy={busy} onProcess={process} onReset={() => { input.reset(); out.reset(); setErr(null); }} processLabel={`Convert to ${outKey.toUpperCase()}`} />
        </ControlsCard>
      }
    >
      {!input.file && <FileDropzone accept={tool.accept} onFiles={(f) => input.load(f[0])} title={undefined} />}
      {input.error && <Alert tone="error">{input.error}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {input.url && input.img && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={input.url} label="Original" width={input.img.naturalWidth} height={input.img.naturalHeight} bytes={input.file!.size} />
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label="Converted" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(input.file!.name, MIME_OUT[outKey].ext)} label="Download converted image" />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
              Converted image appears here
            </div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- SVG rasterizer ---------------- */

export function SvgRasterPanel({ tool }: { tool: Tool }) {
  const isJpg = tool.config?.format === "jpeg";
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("image.svg");
  const [fileSize, setFileSize] = useState(0);
  const srcUrl = useMemo(() => (text ? blobUrl(new Blob([text], { type: "image/svg+xml" })) : null), [text]);
  const [scale, setScale] = useState(2);
  const [bg, setBg] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const out = useOutput();
  const toast = useToast();

  const loadFile = async (f: File) => {
    setErr(null); out.reset();
    setFileName(f.name); setFileSize(f.size);
    try { setText(await f.text()); } catch { setErr("Could not read the SVG file."); }
  };

  const process = async () => {
    if (!text) return;
    setBusy(true); setErr(null); out.reset();
    try {
      const canvas = await rasterizeSvg(text, scale, isJpg ? bg : undefined);
      const blob = await canvasToBlob(canvas, isJpg ? "image/jpeg" : "image/png", 0.92);
      out.set(blob, canvas.width, canvas.height);
      toast("SVG rasterized");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <ToolGrid
      controls={
        <ControlsCard title="Rasterize settings">
          <Field label="Scale multiplier" hint="2× is retina-ready, 4× suits print.">
            <Select value={String(scale)} onChange={(e) => setScale(Number(e.target.value))}>
              <option value="1">1× — original size</option>
              <option value="2">2× — double</option>
              <option value="4">4× — quadruple</option>
            </Select>
          </Field>
          {isJpg && <ColorInput label="Background color" value={bg} onChange={setBg} />}
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold leading-relaxed text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
            Scripts and event handlers are stripped from the SVG before rendering for your safety.
          </p>
          <ActionRow hasInput={Boolean(text)} busy={busy} onProcess={process} onReset={() => { setText(null); out.reset(); setErr(null); }} processLabel="Rasterize SVG" />
        </ControlsCard>
      }
    >
      {!text && <FileDropzone accept=".svg,image/svg+xml" onFiles={(f) => loadFile(f[0])} title="Drop an SVG file here" />}
      {err && <Alert tone="error">{err}</Alert>}
      {text && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            {srcUrl && <ImagePreview src={srcUrl} label={`Source · ${fileName}`} bytes={fileSize} checker />}
          </div>
          {out.url ? (
            <div className="space-y-4">
              <ImagePreview src={out.url} label={`Rasterized ${scale}×`} width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
              <DownloadButton blob={out.blob} filename={replaceExt(fileName, isJpg ? "jpg" : "png")} label={`Download ${isJpg ? "JPG" : "PNG"}`} />
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-400 dark:border-ink-700">
              Rasterized preview appears here
            </div>
          )}
        </div>
      )}
    </ToolGrid>
  );
}

/* ---------------- HEIC ---------------- */

export function HeicPanel({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const out = useOutput();
  const toast = useToast();

  const process = async (f: File) => {
    setFile(f); setBusy(true); setErr(null); out.reset();
    try {
      const heic2any = (await import("heic2any")).default;
      const result = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.92 });
      const blob = Array.isArray(result) ? result[0] : result;
      if (!blob) throw new Error("Decoding produced no output.");
      const { loadImageFromFile } = await import("../lib/image");
      const img = await loadImageFromFile(blob);
      out.set(blob, img.naturalWidth, img.naturalHeight);
      toast("HEIC converted to JPG");
    } catch (e) {
      setErr(
        "This HEIC file could not be decoded on your device. Some browsers (particularly Firefox on certain systems) lack HEVC support — try Chrome, Edge or Safari, or export the photo as JPG on your phone first.",
      );
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <FileDropzone accept={tool.accept} onFiles={(f) => process(f[0])} title="Drop an HEIC / HEIF photo here" subtitle="Decoded locally with WebAssembly — or" />
      {busy && (
        <Alert tone="info">
          Decoding HEIC locally — large photos can take a few seconds. <span className="pulse-soft">Working…</span>
        </Alert>
      )}
      {err && <Alert tone="error">{err}</Alert>}
      {out.url && file && (
        <div className="space-y-4">
          <ImagePreview src={out.url} label="Converted JPG" width={out.dims?.w} height={out.dims?.h} bytes={out.blob!.size} />
          <DownloadButton blob={out.blob} filename={replaceExt(file.name, "jpg")} label="Download JPG" />
        </div>
      )}
    </div>
  );
}

/* ---------------- Base64 encode ---------------- */

export function Base64Panel({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (f: File) => {
    setFile(f); setBusy(true); setErr(null); setDataUri(null);
    try { setDataUri(await fileToDataUrl(f)); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const raw = useMemo(() => (dataUri ? dataUri.split(",")[1] ?? "" : ""), [dataUri]);

  return (
    <div className="space-y-5">
      <FileDropzone accept={tool.accept} onFiles={(f) => load(f[0])} />
      {busy && <Alert tone="info">Encoding…</Alert>}
      {err && <Alert tone="error">{err}</Alert>}
      {dataUri && file && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Original size" value={formatBytes(file.size)} />
            <Stat label="Base64 size" value={formatBytes(raw.length)} />
            <Stat label="Overhead" value={`+${(((raw.length - file.size) / file.size) * 100).toFixed(0)}%`} tone="ok" />
          </div>
          <div className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-700/60 dark:bg-ink-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-bold text-ink-800 dark:text-ink-100">Data URI (ready for src= and CSS)</h3>
              <div className="flex gap-2">
                <CopyButton text={dataUri} label="Copy URI" />
                <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => downloadBlob(`${file.name}.base64.txt`, new Blob([dataUri], { type: "text/plain" }))}>
                  .txt
                </Button>
              </div>
            </div>
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-[11px] leading-relaxed text-ink-600 dark:bg-ink-950 dark:text-ink-300">
              {dataUri.slice(0, 300)}{dataUri.length > 300 ? "…" : ""}
            </pre>
          </div>
          <div className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-700/60 dark:bg-ink-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-bold text-ink-800 dark:text-ink-100">Raw Base64</h3>
              <CopyButton text={raw} label="Copy Base64" />
            </div>
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-[11px] leading-relaxed text-ink-600 dark:bg-ink-950 dark:text-ink-300">
              {raw.slice(0, 240)}{raw.length > 240 ? "…" : ""}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Base64 decode ---------------- */

function detectMime(b64: string): string | null {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("R0lG")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  if (b64.startsWith("PHN2Z") || b64.startsWith("PD94bWwg")) return "image/svg+xml";
  return null;
}

export function Base64DecodePanel({ tool }: { tool: Tool }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const decode = () => {
    setErr(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    setUrl(null); setBlob(null); setMime(null);
    let input = text.trim();
    if (!input) { setErr("Paste a Base64 string first."); return; }
    input = input.replace(/^["']|["']$/g, "");
    let detected = "image/png";
    const m = input.match(/^data:([^;,]+)[;,]/);
    if (m) {
      detected = m[1];
      input = input.replace(/^data:[^,]+,/, "");
    } else {
      const d = detectMime(input);
      if (d) detected = d;
      else if (!/^[A-Za-z0-9+/=\s]+$/.test(input.slice(0, 200))) {
        setErr("This does not look like valid Base64 data.");
        return;
      }
    }
    input = input.replace(/\s/g, "");
    try {
      const bin = atob(input);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const b = new Blob([bytes], { type: detected });
      const u = URL.createObjectURL(b);
      urlRef.current = u;
      setBlob(b); setUrl(u); setMime(detected);
    } catch {
      setErr("Decoding failed — the string appears truncated or contains invalid characters.");
    }
  };

  const ext = mime?.includes("jpeg") ? "jpg" : mime?.includes("svg") ? "svg" : mime?.replace("image/", "") ?? "png";

  return (
    <div className="space-y-5">
      <Field label="Base64 string or data URI" hint="Both raw Base64 and full data:image/… URIs are accepted.">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="data:image/png;base64,iVBOR… or raw iVBOR…"
          className="focus-ring w-full rounded-lg border border-ink-200 bg-white p-3 font-mono text-xs text-ink-800 placeholder:text-ink-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100"
        />
      </Field>
      <Button onClick={decode} disabled={!text.trim()}>Decode image</Button>
      {err && <Alert tone="error">{err}</Alert>}
      {url && blob && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={url} label={`Decoded · ${mime}`} bytes={blob.size} />
          <div className="flex flex-col justify-center gap-3">
            <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Decoded successfully as <span className="font-mono font-bold text-brand-700 dark:text-brand-300">{mime}</span>.</p>
            <DownloadButton blob={blob} filename={`decoded-image.${ext}`} label="Download image" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Image → PDF ---------------- */

interface PdfEntry { id: string; file: File; url: string; img: HTMLImageElement; }

export function PdfPanel({ tool }: { tool: Tool }) {
  const [entries, setEntries] = useState<PdfEntry[]>([]);
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState("auto");
  const [margin, setMargin] = useState("24");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const addFiles = async (files: File[]) => {
    setErr(null);
    const { loadImageFromFile } = await import("../lib/image");
    for (const f of files) {
      try {
        const img = await loadImageFromFile(f);
        const url = URL.createObjectURL(f);
        setEntries((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, file: f, url, img }]);
      } catch { /* skip undecodable */ }
    }
  };

  const move = (i: number, dir: -1 | 1) =>
    setEntries((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeAt = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (!entries.length) return;
    setBusy(true); setErr(null);
    try {
      const { jsPDF } = await import("jspdf");
      const PAGE_SIZES: Record<string, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };
      const m = parseInt(margin, 10) || 0;
      let doc: InstanceType<typeof jsPDF> | null = null;
      for (const e of entries) {
        const landscapeImg = e.img.naturalWidth > e.img.naturalHeight;
        const orient = orientation === "auto" ? (landscapeImg ? "landscape" : "portrait") : orientation;
        let pw: number, ph: number;
        if (pageSize === "fit") {
          pw = e.img.naturalWidth * 0.75; ph = e.img.naturalHeight * 0.75;
        } else {
          const [w, h] = PAGE_SIZES[pageSize];
          pw = orient === "landscape" ? h : w;
          ph = orient === "landscape" ? w : h;
        }
        if (!doc) doc = new jsPDF({ orientation: orient as "portrait" | "landscape", unit: "pt", format: pageSize === "fit" ? [pw, ph] : pageSize });
        else doc.addPage(pageSize === "fit" ? [pw, ph] : pageSize, orient as "portrait" | "landscape");
        const availW = pw - m * 2, availH = ph - m * 2;
        const ratio = Math.min(availW / e.img.naturalWidth, availH / e.img.naturalHeight, pageSize === "fit" ? 0.75 : Infinity);
        const dw = e.img.naturalWidth * ratio, dh = e.img.naturalHeight * ratio;
        const hasAlpha = e.file.type === "image/png" || e.file.type === "image/webp";
        const c = scaleImage(e.img, e.img.naturalWidth, e.img.naturalHeight, Math.min(e.img.naturalWidth, 2200), Math.round(Math.min(e.img.naturalWidth, 2200) * (e.img.naturalHeight / e.img.naturalWidth)));
        const dataUrl = c.toDataURL(hasAlpha ? "image/png" : "image/jpeg", 0.92);
        doc.addImage(dataUrl, hasAlpha ? "PNG" : "JPEG", (pw - dw) / 2, (ph - dh) / 2, dw, dh);
      }
      doc!.save("images.pdf");
      toast("PDF downloaded");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <FileDropzone accept={tool.accept} multiple onFiles={addFiles} title="Drop images here — each becomes a PDF page" />
      {err && <Alert tone="error">{err}</Alert>}
      {entries.length > 0 && (
        <ToolGrid
          controls={
            <ControlsCard title="PDF settings">
              <Field label="Page size">
                <Select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                  <option value="fit">Fit to image</option>
                </Select>
              </Field>
              {pageSize !== "fit" && (
                <Field label="Orientation">
                  <Select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                    <option value="auto">Auto (per image)</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </Select>
                </Field>
              )}
              {pageSize !== "fit" && (
                <Field label="Margins">
                  <Select value={margin} onChange={(e) => setMargin(e.target.value)}>
                    <option value="0">None</option>
                    <option value="24">Small</option>
                    <option value="48">Large</option>
                  </Select>
                </Field>
              )}
              <ActionRow hasInput onProcess={generate} busy={busy} onReset={() => setEntries([])} processLabel={`Generate PDF (${entries.length} page${entries.length > 1 ? "s" : ""})`} />
            </ControlsCard>
          }
        >
          <ol className="space-y-2" aria-label="PDF page order">
            {entries.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 rounded-lg border border-ink-200/70 bg-white px-3 py-2.5 dark:border-ink-700/60 dark:bg-ink-900">
                <span className="w-10 shrink-0 font-display text-sm font-bold text-ink-400">#{i + 1}</span>
                <img src={e.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-700 dark:text-ink-200">{e.file.name}</span>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" className="p-1.5" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={15} /></Button>
                  <Button variant="ghost" className="p-1.5" onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label="Move down"><ArrowDown size={15} /></Button>
                  <Button variant="ghost" className="p-1.5 hover:text-rose-600" onClick={() => removeAt(i)} aria-label="Remove page"><Trash2 size={15} /></Button>
                </div>
              </li>
            ))}
          </ol>
        </ToolGrid>
      )}
    </div>
  );
}

/* ---------------- ZIP ---------------- */

export function ZipPanel({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const blob = await makeZip(files.map((f) => ({ name: f.name, data: f })));
      downloadBlob("images.zip", blob);
      toast("ZIP downloaded");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <FileDropzone accept={tool.accept} multiple onFiles={(f) => setFiles((prev) => [...prev, ...f])} title="Drop images to bundle" />
      {files.length > 0 && (
        <div className="space-y-4">
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-[13px] font-semibold dark:border-ink-700/60 dark:bg-ink-900">
                <span className="truncate text-ink-700 dark:text-ink-200">{f.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[11px] text-ink-400">{formatBytes(f.size)}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="focus-ring rounded text-ink-400 hover:text-rose-600" aria-label={`Remove ${f.name}`}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {err && <Alert tone="error">{err}</Alert>}
          <Button onClick={create} busy={busy} className="w-full">Create ZIP of {files.length} file{files.length > 1 ? "s" : ""}</Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Blob URL ---------------- */

export function BlobUrlPanel({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  const load = (f: File) => {
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setRevoked(false);
  };

  const revoke = () => {
    if (url) URL.revokeObjectURL(url);
    setRevoked(true);
  };

  return (
    <div className="space-y-5">
      <FileDropzone accept={tool.accept} onFiles={(f) => load(f[0])} />
      {url && file && !revoked && (
        <div className="grid gap-5 md:grid-cols-2">
          <ImagePreview src={url} label="Preview via blob URL" bytes={file.size} />
          <div className="space-y-4">
            <div className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-ink-700/60 dark:bg-ink-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-bold text-ink-800 dark:text-ink-100">Temporary blob URL</h3>
                <CopyButton text={url} label="Copy URL" />
              </div>
              <pre className="mt-3 overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-[11px] text-ink-600 dark:bg-ink-950 dark:text-ink-300">{url}</pre>
            </div>
            <Alert tone="info">
              Blob URLs only work in <strong>this browser tab</strong> and disappear when you revoke them or close the page. They are perfect for testing upload flows.
            </Alert>
            <Button variant="danger" onClick={revoke} className="w-full">Revoke URL now</Button>
          </div>
        </div>
      )}
      {revoked && (
        <Alert tone="warn">URL revoked — the memory is released and the link no longer resolves. Upload another image to create a new one.</Alert>
      )}
    </div>
  );
}
