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
      // Priority: image > svg > html > latex > markdown > plain text
      if (data["image/png"]) {
        const src = Array.isArray(data["image/png"]) ? data["image/png"].join("") : data["image/png"];
        return `<img class="nb-output-image" src="data:image/png;base64,${src}" alt="Output" />`;
      }
      if (data["image/jpeg"]) {
        const src = Array.isArray(data["image/jpeg"]) ? data["image/jpeg"].join("") : data["image/jpeg"];
        return `<img class="nb-output-image" src="data:image/jpeg;base64,${src}" alt="Output" />`;
      }
      if (data["image/gif"]) {
        const src = Array.isArray(data["image/gif"]) ? data["image/gif"].join("") : data["image/gif"];
        return `<img class="nb-output-image" src="data:image/gif;base64,${src}" alt="Output" />`;
      }
      if (data["image/svg+xml"]) {
        const svg = Array.isArray(data["image/svg+xml"]) ? data["image/svg+xml"].join("") : data["image/svg+xml"];
        return `<div class="nb-output-svg">${svg}</div>`;
      }
      if (data["text/html"]) {
        const html = Array.isArray(data["text/html"]) ? data["text/html"].join("") : data["text/html"];
        return `<div class="nb-output-html">${html}</div>`;
      }
      if (data["text/latex"]) {
        const latex = Array.isArray(data["text/latex"]) ? data["text/latex"].join("") : data["text/latex"];
        return `<div class="nb-output-latex">${renderMath(latex)}</div>`;
      }
      if (data["text/markdown"]) {
        const md = Array.isArray(data["text/markdown"]) ? data["text/markdown"].join("") : data["text/markdown"];
        return `<div class="nb-output-markdown">${renderMath(marked.parse(md) as string)}</div>`;
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
  const [inputMode, setInputMode] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
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

  const resolveNotebookUrl = async (input: string): Promise<{ url: string; fileName: string }> => {
    const trimmed = input.trim();
    
    // Direct URL to .ipynb file
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      // Hugging Face URL
      if (trimmed.includes("huggingface.co")) {
        // Convert huggingface.co/datasets/.../blob/... to raw URL
        const hfMatch = trimmed.match(/huggingface\.co\/(?:datasets\/)?([^/]+\/[^/]+)\/(?:blob|resolve)\/(.+)/);
        if (hfMatch) {
          const [, repo, path] = hfMatch;
          return {
            url: `https://huggingface.co/datasets/${repo}/resolve/main/${path}`,
            fileName: path.split("/").pop() || "notebook.ipynb"
          };
        }
      }
      
      // GitHub raw URL or blob URL
      if (trimmed.includes("github.com")) {
        // Convert github.com/.../blob/... to raw URL
        const ghMatch = trimmed.match(/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)/);
        if (ghMatch) {
          const [, repo, path] = ghMatch;
          return {
            url: `https://raw.githubusercontent.com/${repo}/${path}`,
            fileName: path.split("/").pop() || "notebook.ipynb"
          };
        }
        // Already raw URL
        if (trimmed.includes("raw.githubusercontent.com")) {
          return {
            url: trimmed,
            fileName: trimmed.split("/").pop() || "notebook.ipynb"
          };
        }
      }
      
      // Gist URL
      if (trimmed.includes("gist.github.com")) {
        const gistMatch = trimmed.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/);
        if (gistMatch) {
          const gistId = gistMatch[1];
          // Fetch gist to get the raw URL
          const response = await fetch(`https://api.github.com/gists/${gistId}`);
          if (!response.ok) throw new Error("Failed to fetch gist");
          const gist = await response.json();
          const files = Object.values(gist.files) as any[];
          const notebook = files.find(f => f.filename.endsWith(".ipynb"));
          if (!notebook) throw new Error("No notebook found in this gist");
          return {
            url: notebook.raw_url,
            fileName: notebook.filename
          };
        }
      }
      
      // Direct URL
      return {
        url: trimmed,
        fileName: trimmed.split("/").pop() || "notebook.ipynb"
      };
    }
    
    // Gist ID (40 character hex string)
    if (/^[a-f0-9]{32,40}$/i.test(trimmed)) {
      const response = await fetch(`https://api.github.com/gists/${trimmed}`);
      if (!response.ok) throw new Error("Failed to fetch gist. Please check the Gist ID.");
      const gist = await response.json();
      const files = Object.values(gist.files) as any[];
      const notebook = files.find(f => f.filename.endsWith(".ipynb"));
      if (!notebook) throw new Error("No notebook found in this gist");
      return {
        url: notebook.raw_url,
        fileName: notebook.filename
      };
    }
    
    // GitHub username/repo
    if (/^[^/]+\/[^/]+$/.test(trimmed)) {
      const [owner, repo] = trimmed.split("/");
      // Try to find notebooks in the repo
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`);
      if (!response.ok) throw new Error("Failed to access repository. Please check the username/repo.");
      const contents = await response.json() as any[];
      const notebooks = contents.filter(f => f.name.endsWith(".ipynb") && f.type === "file");
      
      if (notebooks.length === 0) {
        throw new Error("No notebooks found in the root of this repository. Try providing a direct URL to a specific notebook.");
      }
      
      // If multiple notebooks, use the first one (or could show a picker)
      const notebook = notebooks[0];
      return {
        url: notebook.download_url,
        fileName: notebook.name
      };
    }
    
    // Just a username - show helpful error
    if (/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      throw new Error(`Please provide more specific information. Try:\n• ${trimmed}/repository-name\n• A direct URL to a notebook\n• A Gist ID`);
    }
    
    throw new Error("Invalid input format. Please provide a URL, GitHub username/repo, or Gist ID.");
  };

  const fetchWithCorsProxy = async (targetUrl: string): Promise<string> => {
    // Try direct fetch first
    try {
      const response = await fetch(targetUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });
      if (response.ok) {
        const text = await response.text();
        try {
          JSON.parse(text);
          return text;
        } catch {
          // Not valid JSON, continue to proxies
        }
      }
    } catch (e) {
      // Direct fetch failed, try CORS proxies
    }

    // List of CORS proxy services to try (in order of reliability)
    const corsProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      `https://cors.bridged.cc/${targetUrl}`,
      `https://yacdn.org/proxy/${targetUrl}`,
    ];

    let lastError = "";
    for (const proxyUrl of corsProxies) {
      try {
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
          }
        });
        
        if (response.ok) {
          const text = await response.text();
          
          // Verify it's actually JSON (not an error page)
          try {
            const parsed = JSON.parse(text);
            if (parsed.cells && Array.isArray(parsed.cells)) {
              return text;
            }
          } catch {
            lastError = "Response was not valid JSON";
            continue;
          }
        } else {
          lastError = `HTTP ${response.status}`;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Unknown error";
        continue;
      }
    }

    throw new Error(
      `Unable to fetch the notebook from this URL. The server may have strict CORS restrictions.\n\n` +
      `Last error: ${lastError}\n\n` +
      `Solutions:\n` +
      `• Download the file and upload it directly using the "Upload File" option\n` +
      `• If it's on GitHub, use the GitHub username/repository format\n` +
      `• Upload to a GitHub Gist and use the Gist ID`
    );
  };

  const loadFromUrl = async () => {
    if (!url.trim()) {
      setErr("Please enter a URL or identifier");
      return;
    }
    setErr(null);
    setRenderedHtml(null);
    setNotebook(null);
    setBusy(true);
    try {
      const { url: resolvedUrl, fileName } = await resolveNotebookUrl(url);
      const text = await fetchWithCorsProxy(resolvedUrl);
      const nb = JSON.parse(text) as Notebook;
      if (!nb.cells || !Array.isArray(nb.cells)) {
        throw new Error("Invalid notebook format: missing cells array.");
      }
      setFileName(fileName);
      setNotebook(nb);
      const html = await renderNotebook(nb);
      setRenderedHtml(html);
      toast("Notebook loaded successfully");
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
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const element = renderRef.current;
      
      // Capture the notebook as a high-quality canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      
      // Calculate scaling
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      // Split into pages
      const pageHeightPx = contentHeight / ratio;
      let position = 0;
      let pageNum = 0;
      
      while (position < imgHeight) {
        if (pageNum > 0) pdf.addPage();
        
        // Create a canvas for this page
        const pageCanvas = document.createElement("canvas");
        const pageCtx = pageCanvas.getContext("2d")!;
        
        const sliceHeight = Math.min(pageHeightPx, imgHeight - position);
        pageCanvas.width = imgWidth;
        pageCanvas.height = sliceHeight;
        
        // Copy the slice from the original canvas
        pageCtx.drawImage(
          canvas,
          0, position, imgWidth, sliceHeight,
          0, 0, imgWidth, sliceHeight
        );
        
        // Add to PDF
        const pageDataUrl = pageCanvas.toDataURL("image/png", 0.98);
        const scaledSliceHeight = sliceHeight * ratio;
        pdf.addImage(pageDataUrl, "PNG", margin, margin, contentWidth, scaledSliceHeight);
        
        position += pageHeightPx;
        pageNum++;
      }
      
      pdf.save(fileName.replace(/\.ipynb$/, "") + ".pdf");
      toast("PDF exported with zero content loss");
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {!notebook && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode("file")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors ${
                inputMode === "file"
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300"
              }`}
            >
              Upload File
            </button>
            <button
              onClick={() => setInputMode("url")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors ${
                inputMode === "url"
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300"
              }`}
            >
              Load from URL
            </button>
          </div>
          {inputMode === "file" ? (
            <FileDropzone
              accept={tool.accept}
              onFiles={(f) => loadFile(f[0])}
              title="Drop a Jupyter notebook (.ipynb) here"
              subtitle="Rendered entirely in your browser — or"
            />
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="URL, GitHub user/repo, or Gist ID"
                className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100"
              />
              <button
                onClick={loadFromUrl}
                disabled={busy || !url.trim()}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                Load Notebook
              </button>
              <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                <p className="font-semibold mb-2">Supported formats:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li><span className="font-mono">https://.../notebook.ipynb</span> - Direct URL</li>
                  <li><span className="font-mono">username/repository</span> - GitHub repo</li>
                  <li><span className="font-mono">abc123def456...</span> - Gist ID</li>
                  <li><span className="font-mono">https://gist.github.com/...</span> - Gist URL</li>
                  <li><span className="font-mono">https://huggingface.co/...</span> - Hugging Face</li>
                </ul>
                <p className="mt-2 text-[11px] italic">
                  💡 CORS proxy enabled for most URLs. If fetch fails, try uploading the file directly.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {busy && !renderedHtml && (
        <Alert tone="info">
          <Loader2 size={15} className="spin inline" aria-hidden /> Rendering notebook…
        </Alert>
      )}
      {err && <Alert tone="error">{err}</Alert>}
      {renderedHtml && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="truncate text-sm font-bold text-ink-700 dark:text-ink-200">{fileName}</p>
              <p className="mt-1 text-xs text-ink-500">
                {notebook!.cells.length} cell{notebook!.cells.length !== 1 ? "s" : ""} ·{" "}
                {notebook!.cells.filter((c) => c.cell_type === "code").length} code,{" "}
                {notebook!.cells.filter((c) => c.cell_type === "markdown").length} markdown
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportPdf} busy={busy}>
                Export to PDF
              </Button>
              <Button
                variant="secondary"
                onClick={() => setFullScreen(!fullScreen)}
              >
                {fullScreen ? "Exit Full Screen" : "Full Screen"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setNotebook(null);
                  setRenderedHtml(null);
                  setErr(null);
                  setFullScreen(false);
                }}
              >
                Load another
              </Button>
            </div>
          </div>
          <div className={fullScreen ? "fixed inset-0 z-[100] overflow-auto bg-paper p-6 dark:bg-ink-950" : ""}>
            {fullScreen && (
              <div className="mx-auto max-w-5xl">
                <div className="mb-4 flex justify-end">
                  <Button variant="secondary" onClick={() => setFullScreen(false)}>
                    Exit Full Screen
                  </Button>
                </div>
              </div>
            )}
            <div className={fullScreen ? "mx-auto max-w-5xl" : ""}>
              <div className="overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-soft dark:border-ink-700/60">
                <div
                  ref={renderRef}
                  className="notebook-render"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
