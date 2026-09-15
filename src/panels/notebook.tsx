import { useRef, useState } from "react";
import type { Tool } from "../lib/types";
import { ControlsCard, ToolGrid, ActionRow, errMsg } from "./state";
import { FileDropzone } from "../components/shared";
import { Alert, Button, useToast } from "../components/ui";
import { Loader2 } from "lucide-react";

interface NotebookCell {
  cell_type: "markdown" | "code" | "raw";
  source: string[];
  metadata?: Record<string, unknown>;
  outputs?: NotebookOutput[];
  execution_count?: number | null;
}

interface NotebookOutput {
  output_type: string;
  text?: string[];
  data?: Record<string, string | string[]>;
  name?: string;
  traceback?: string[];
}

interface Notebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function renderNotebook(nb: Notebook): Promise<string> {
  const { marked } = await import("marked");
  const { markedHighlight } = await import("marked-highlight");
  const hljs = (await import("highlight.js")).default;
  const katex = (await import("katex")).default;

  marked.use(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
    }),
  );

  const renderMath = (text: string): string => {
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `<span class="katex-error">${escapeHtml(math)}</span>`;
      }
    });
    text = text.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `<span class="katex-error">${escapeHtml(math)}</span>`;
      }
    });
    return text;
  };

  const joinSource = (source: string[]) => source.join("");

  const renderOutput = (out: NotebookOutput): string => {
    if (out.output_type === "stream") {
      const text = (out.text || []).join("");
      return `<pre class="nb-output-text">${escapeHtml(text)}</pre>`;
    }
    if (out.output_type === "execute_result" || out.output_type === "display_data") {
      const data = out.data || {};
      if (data["image/png"]) {
        const src = Array.isArray(data["image/png"]) ? data["image/png"].join("") : data["image/png"];
        return `<img class="nb-output-image" src="data:image/png;base64,${src}" alt="Output" />`;
      }
      if (data["image/jpeg"]) {
        const src = Array.isArray(data["image/jpeg"]) ? data["image/jpeg"].join("") : data["image/jpeg"];
        return `<img class="nb-output-image" src="data:image/jpeg;base64,${src}" alt="Output" />`;
      }
      if (data["text/html"]) {
        const html = Array.isArray(data["text/html"]) ? data["text/html"].join("") : data["text/html"];
        return `<div class="nb-output-html">${html}</div>`;
      }
      if (data["text/latex"]) {
        const latex = Array.isArray(data["text/latex"]) ? data["text/latex"].join("") : data["text/latex"];
        return `<div class="nb-output-latex">${renderMath(latex)}</div>`;
      }
      if (data["text/plain"]) {
        const text = Array.isArray(data["text/plain"]) ? data["text/plain"].join("") : data["text/plain"];
        return `<pre class="nb-output-text">${escapeHtml(text)}</pre>`;
      }
    }
    if (out.output_type === "error") {
      const traceback = out.traceback || [];
      return `<pre class="nb-output-error">${escapeHtml(traceback.join("\n"))}</pre>`;
    }
    return "";
  };

  let html = '<div class="notebook-container">';
  for (const cell of nb.cells) {
    if (cell.cell_type === "markdown") {
      const source = joinSource(cell.source);
      const rendered = renderMath(marked.parse(source) as string);
      html += `<div class="nb-cell nb-markdown">${rendered}</div>`;
    } else if (cell.cell_type === "code") {
      const source = joinSource(cell.source);
      const lang = ((nb.metadata as any)?.kernelspec?.language as string) || "python";
      const highlighted = hljs.getLanguage(lang)
        ? hljs.highlight(source, { language: lang }).value
        : hljs.highlightAuto(source).value;
      const execCount =
        cell.execution_count !== null && cell.execution_count !== undefined
          ? `[${cell.execution_count}]`
          : "[ ]";
      html += `<div class="nb-cell nb-code">`;
      html += `<div class="nb-code-header"><span class="nb-exec-count">${execCount}</span></div>`;
      html += `<pre class="nb-code-source"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      if (cell.outputs && cell.outputs.length > 0) {
        html += `<div class="nb-outputs">`;
        for (const out of cell.outputs) {
          html += renderOutput(out);
        }
        html += `</div>`;
      }
      html += `</div>`;
    } else if (cell.cell_type === "raw") {
      const source = joinSource(cell.source);
      html += `<div class="nb-cell nb-raw"><pre>${escapeHtml(source)}</pre></div>`;
    }
  }
  html += "</div>";
  return html;
}

export function NotebookPanel({ tool }: { tool: Tool }) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const renderRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const loadFile = async (f: File) => {
    setErr(null);
    setRenderedHtml(null);
    setNotebook(null);
    setFileName(f.name);
    setBusy(true);
    try {
      const text = await f.text();
      const nb = JSON.parse(text) as Notebook;
      if (!nb.cells || !Array.isArray(nb.cells)) {
        throw new Error("Invalid notebook format: missing cells array.");
      }
      setNotebook(nb);
      const html = await renderNotebook(nb);
      setRenderedHtml(html);
      toast("Notebook rendered successfully");
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!renderRef.current || !renderedHtml) return;
    setBusy(true);
    setErr(null);
    try {
      // Dynamically import html2pdf.js which bundles html2canvas + jsPDF
      const html2pdf = (await import("html2pdf.js")).default;
      const element = renderRef.current;
      html2pdf()
        .from(element)
        .set({
          margin: [10, 10, 10, 10],
          filename: fileName.replace(/\.ipynb$/, "") + ".pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .save()
        .then(() => {
          toast("PDF exported with zero content loss");
          setBusy(false);
        })
        .catch((e: unknown) => {
          setErr(errMsg(e));
          setBusy(false);
        });
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {!notebook && (
        <FileDropzone
          accept={tool.accept}
          onFiles={(f) => loadFile(f[0])}
          title="Drop a Jupyter notebook (.ipynb) here"
          subtitle="Rendered entirely in your browser — or"
        />
      )}
      {busy && !renderedHtml && (
        <Alert tone="info">
          <Loader2 size={15} className="spin inline" aria-hidden /> Rendering notebook…
        </Alert>
      )}
      {err && <Alert tone="error">{err}</Alert>}
      {renderedHtml && (
        <ToolGrid
          controls={
            <ControlsCard title="Notebook info">
              <p className="truncate text-sm font-bold text-ink-700 dark:text-ink-200">{fileName}</p>
              <p className="mt-2 text-xs text-ink-500">
                {notebook!.cells.length} cell{notebook!.cells.length !== 1 ? "s" : ""} ·{" "}
                {notebook!.cells.filter((c) => c.cell_type === "code").length} code,{" "}
                {notebook!.cells.filter((c) => c.cell_type === "markdown").length} markdown
              </p>
              <div className="mt-4 space-y-3">
                <Button onClick={exportPdf} busy={busy} className="w-full">
                  Export to PDF
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setNotebook(null);
                    setRenderedHtml(null);
                    setErr(null);
                  }}
                  className="w-full"
                >
                  Load another notebook
                </Button>
              </div>
            </ControlsCard>
          }
        >
          <div className="overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-soft dark:border-ink-700/60">
            <div
              ref={renderRef}
              className="notebook-render"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </ToolGrid>
      )}
    </div>
  );
}
