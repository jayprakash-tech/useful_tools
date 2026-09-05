import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Settings2, FileImage, X, Loader2 } from "lucide-react";
import { loadImageFromFile, makeZip, downloadBlob, nextId, formatBytes } from "../lib/image";
import type { BatchItem } from "../lib/types";
import { Button, cx, useToast } from "../components/ui";
import { DownloadButton } from "../components/shared";

export const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong while processing the image. Please try a different file.";

/* ---------------- single-image input ---------------- */

export interface ImageInput {
  file: File | null;
  url: string | null;
  img: HTMLImageElement | null;
  error: string | null;
  loading: boolean;
  load: (f: File) => void;
  reset: () => void;
}

export function useImageInput(): ImageInput {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setFile(null);
    setUrl(null);
    setImg(null);
    setError(null);
    setLoading(false);
  }, []);

  const load = useCallback((f: File) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    setFile(f);
    setImg(null);
    setError(null);
    setLoading(true);
    const u = URL.createObjectURL(f);
    urlRef.current = u;
    setUrl(u);
    loadImageFromFile(f)
      .then((i) => { setImg(i); setError(null); })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  return { file, url, img, error, loading, load, reset };
}

/* ---------------- output ---------------- */

export interface Output {
  blob: Blob | null;
  url: string | null;
  dims: { w: number; h: number } | null;
  set: (b: Blob, w?: number, h?: number) => void;
  reset: () => void;
}

export function useOutput(): Output {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const urlRef = useRef<string | null>(null);

  const set = useCallback((b: Blob, w?: number, h?: number) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const u = URL.createObjectURL(b);
    urlRef.current = u;
    setBlob(b);
    setUrl(u);
    setDims(w && h ? { w, h } : null);
  }, []);

  const reset = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setBlob(null);
    setUrl(null);
    setDims(null);
  }, []);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  return { blob, url, dims, set, reset };
}

/* ---------------- layout pieces ---------------- */

export function ControlsCard({ title = "Options", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
      <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <Settings2 size={14} aria-hidden /> {title}
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </div>
  );
}

export function ToolGrid({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-5">{controls}</div>
      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
}

export function ActionRow({ onProcess, busy, onReset, hasInput, processLabel = "Process", disabled }: {
  onProcess: () => void; busy?: boolean; onReset?: () => void; hasInput: boolean; processLabel?: string; disabled?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <Button onClick={onProcess} busy={busy} disabled={!hasInput || disabled} className="flex-1">
        {processLabel}
      </Button>
      {onReset && hasInput && (
        <Button variant="secondary" onClick={onReset} disabled={busy}>Reset</Button>
      )}
    </div>
  );
}

export function FileChip({ name, size, onRemove }: { name: string; size: number; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-ink-200/70 bg-ink-50 px-3 py-2 dark:border-ink-700/60 dark:bg-ink-800">
      <FileImage size={15} className="shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-700 dark:text-ink-200">{name}</span>
      <span className="shrink-0 font-mono text-[11px] font-bold text-ink-400">{formatBytes(size)}</span>
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove ${name}`} className="focus-ring shrink-0 rounded p-0.5 text-ink-400 hover:text-rose-600">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------------- batch ---------------- */

export interface BatchState {
  items: BatchItem[];
  addFiles: (files: File[]) => void;
  remove: (id: string) => void;
  clear: () => void;
  run: (fn: (item: BatchItem) => Promise<{ blob: Blob; name: string; note?: string }>) => Promise<void>;
  zipAll: (zipName: string) => Promise<void>;
  progress: { done: number; total: number } | null;
  running: boolean;
}

export function useBatch(): BatchState {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const itemsRef = useRef<BatchItem[]>([]);
  itemsRef.current = items;
  const toast = useToast();

  const addFiles = useCallback((files: File[]) => {
    setItems((prev) => [...prev, ...files.map((f) => ({ id: nextId(), file: f, url: URL.createObjectURL(f), status: "pending" as const }))]);
  }, []);

  const update = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]);
    setProgress(null);
  }, []);

  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url)), []);

  const run = useCallback(
    async (fn: (item: BatchItem) => Promise<{ blob: Blob; name: string; note?: string }>) => {
      const list = itemsRef.current;
      if (!list.length) return;
      setRunning(true);
      setProgress({ done: 0, total: list.length });
      for (const item of list) {
        update(item.id, { status: "working" });
        try {
          const r = await fn(item);
          update(item.id, { status: "done", outBlob: r.blob, outName: r.name, note: r.note });
        } catch (e) {
          update(item.id, { status: "error", error: errMsg(e) });
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      setRunning(false);
      toast("Batch processing finished", "info");
    },
    [update, toast],
  );

  const zipAll = useCallback(
    async (zipName: string) => {
      const done = itemsRef.current.filter((i) => i.status === "done" && i.outBlob);
      if (!done.length) return;
      const blob = await makeZip(done.map((i) => ({ name: i.outName ?? "file", data: i.outBlob! })));
      downloadBlob(zipName, blob);
      toast(`ZIP with ${done.length} file${done.length > 1 ? "s" : ""} downloaded`);
    },
    [toast],
  );

  return { items, addFiles, remove, clear, run, zipAll, progress, running };
}

export function BatchList({ batch, zipName }: { batch: BatchState; zipName: string }) {
  const { items, progress, running } = batch;
  if (!items.length) return null;
  const doneCount = items.filter((i) => i.status === "done").length;
  return (
    <div className="space-y-4">
      {progress && (
        <div>
          <div className="flex justify-between text-xs font-bold text-ink-500">
            <span>{running ? "Processing…" : "Finished"}</span>
            <span className="tabular-nums">{progress.done} / {progress.total}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total}>
            <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 rounded-lg border border-ink-200/70 bg-white px-3 py-2.5 dark:border-ink-700/60 dark:bg-ink-900">
            <img src={it.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink-800 dark:text-ink-100">{it.file.name}</p>
              <p className="text-[11px] font-semibold text-ink-400">
                {formatBytes(it.file.size)}
                {it.note ? ` → ${it.note}` : ""}
                {it.error ? <span className="text-rose-500"> · {it.error}</span> : null}
              </p>
            </div>
            {it.status === "working" && <Loader2 size={16} className="spin shrink-0 text-brand-600" aria-label="Processing" />}
            {it.status === "error" && <X size={16} className="shrink-0 text-rose-500" aria-label="Failed" />}
            {it.status === "done" && it.outBlob && (
              <DownloadButton blob={it.outBlob} filename={it.outName ?? "file"} label="Save" />
            )}
            {it.status === "pending" && <span className="text-[11px] font-bold uppercase text-ink-300">queued</span>}
          </li>
        ))}
      </ul>
      {doneCount > 1 && (
        <Button variant="dark" className="w-full" onClick={() => batch.zipAll(zipName)}>
          Download all {doneCount} as ZIP
        </Button>
      )}
    </div>
  );
}

export { cx };
