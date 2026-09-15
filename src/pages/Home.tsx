import { useMemo, useRef, useState, useEffect } from "react";
import { Search, ArrowRight, ShieldCheck, Zap, Smartphone, BadgeCheck, Cpu, Lock, Upload, Download, FileImage } from "lucide-react";
import { TOOLS, searchTools, popularTools } from "../lib/tools";
import { CATEGORIES } from "../lib/categories";
import { useSeo, SITE_NAME, navigate } from "../lib/seo";
import { Accordion, Badge, Button, Reveal, cx } from "../components/ui";
import { ToolCard, CategoryCard, toolIcon } from "../components/shared";

function ToolSearch({ big }: { big?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => (q.trim() ? searchTools(q).slice(0, 7) : []), [q]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full">
      <div className={cx("flex items-center gap-3 rounded-xl border bg-white shadow-soft transition-all focus-within:border-brand-500 focus-within:shadow-lift dark:bg-ink-900", big ? "border-ink-200 px-4 py-3.5 dark:border-ink-600" : "border-ink-200 px-3.5 py-2.5 dark:border-ink-600")}>
        <Search size={big ? 19 : 16} className="shrink-0 text-ink-400" aria-hidden />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) navigate(`/tools/${results[0].slug}`); }}
          placeholder="Search 75 tools — try “compress”, “pdf”, “resize”…"
          aria-label="Search image tools"
          className="w-full bg-transparent text-[15px] font-medium text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-100"
        />
      </div>
      {open && q.trim() && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-ink-200/80 bg-white shadow-lift dark:border-ink-700 dark:bg-ink-900">
          {results.length === 0 ? (
            <p className="px-4 py-3.5 text-sm font-semibold text-ink-400">No tools match “{q}”.</p>
          ) : (
            results.map((t) => {
              const Icon = toolIcon(t.icon);
              return (
                <a key={t.slug} href={`#/tools/${t.slug}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-50 dark:hover:bg-ink-800">
                  <span className="rounded-md bg-brand-100 p-1.5 text-brand-700 dark:bg-brand-900/70 dark:text-brand-300"><Icon size={14} aria-hidden /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink-800 dark:text-ink-100">{t.name}</span>
                    <span className="block truncate text-xs text-ink-400">{t.short}</span>
                  </span>
                </a>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="float-y relative rounded-2xl border border-ink-200/70 bg-white p-5 shadow-lift dark:border-ink-700/60 dark:bg-ink-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-brand-600 p-2 text-white"><FileImage size={17} aria-hidden /></span>
            <div>
              <p className="text-sm font-bold text-ink-900 dark:text-white">vacation-photo.jpg</p>
              <p className="font-mono text-[11px] font-bold text-ink-400">4000 × 3000 px</p>
            </div>
          </div>
          <Badge tone="ok">processed locally</Badge>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-bold text-ink-400"><span>Original</span><span className="font-mono">4.2 MB</span></div>
            <div className="h-2.5 rounded-full bg-ink-100 dark:bg-ink-800"><div className="h-full w-full rounded-full bg-ink-300 dark:bg-ink-600" /></div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-bold text-ink-400"><span>After compression</span><span className="font-mono text-brand-700 dark:text-brand-300">386 KB · −91%</span></div>
            <div className="h-2.5 rounded-full bg-ink-100 dark:bg-ink-800"><div className="h-full w-[9%] rounded-full bg-brand-600" /></div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="rounded-lg bg-ink-50 px-2.5 py-1.5 font-mono text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">canvas.toBlob()</span>
          <span className="rounded-lg bg-ink-50 px-2.5 py-1.5 font-mono text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">0 requests sent</span>
        </div>
      </div>
      <div className="absolute -right-3 -top-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 shadow-soft dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
        ✓ nothing uploaded
      </div>
      <div className="absolute -bottom-4 -left-3 rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs font-bold text-ink-600 shadow-soft dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">
        ⚡ Web Workers + Canvas
      </div>
    </div>
  );
}

const FAQS: [string, string][] = [
  ["Are these tools really free?", "Yes — every one of the 75 tools is free with no usage caps, trial timers or premium tiers. The site is supported by unobtrusive advertising placed away from the tool controls."],
  ["Are my images uploaded to a server?", "No. All processing happens in your browser using the HTML Canvas API and Web Workers. You can verify it yourself: open your browser's network tab while using any tool and you will see zero image uploads."],
  ["What formats are supported?", "Input support covers JPG, PNG, WEBP, GIF, SVG and (on supporting browsers) HEIC. Output formats include JPG, PNG, WEBP, PDF, ZIP and Base64 depending on the tool."],
  ["Can I use the tools on mobile?", "Yes. Every tool is responsive and touch-friendly — cropping, dragging and sliders all work with a finger as well as a mouse."],
  ["Do I need an account?", "No accounts, no email, no sign-up. Open a tool, drop in a file, download the result. That is the whole workflow."],
  ["Can I use the outputs commercially?", "Yes. The tools make no claim over your files or the results. You are responsible for having the rights to the images you process."],
  ["Are there file size limits?", "There is no hard limit, but very large files (40 MB+) can slow a browser tab. For best performance stay under ~25 MB per image; batch tools process files sequentially to stay smooth."],
];

export function HomePage() {
  useSeo(
    `${SITE_NAME} — Free Online Image Tools, No Upload`,
    "Compress, convert, resize, crop, enhance and transform images 100% in your browser. 75 free image tools — no upload, no account, no watermarks.",
  );
  const popular = popularTools();

  return (
    <div>
      {/* ---------- Hero ---------- */}
      <section className="dots-bg relative overflow-hidden border-b border-ink-200/70 dark:border-ink-800">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100/70 to-transparent dark:from-brand-950/50" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-300/70 bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-800 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
                <ShieldCheck size={13} aria-hidden /> 76 tools · everything stays on your device
              </div>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="mt-5 font-display text-[42px] font-bold leading-[1.04] tracking-tight text-ink-950 sm:text-6xl dark:text-white">
                Tools that never
                <span className="relative whitespace-nowrap text-brand-700 dark:text-brand-400">
                  {" "}see your data.
                  <svg className="absolute -bottom-1.5 left-1 w-full" height="8" viewBox="0 0 220 8" fill="none" preserveAspectRatio="none" aria-hidden><path d="M2 6C60 1.5 160 1.5 218 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand-300 dark:text-brand-700" /></svg>
                </span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-500 dark:text-ink-300">
                Image processing, Jupyter notebook viewing, PDF conversion and more — all in your browser.
                No uploads, no accounts, no watermarks. Just fast, private tools that work offline after loading.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-8 max-w-xl">
                <ToolSearch big />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Quick start:</span>
                  {["image-compressor", "jupyter-notebook-viewer", "image-to-pdf", "color-picker", "qr-code-generator"].map((slug) => {
                    const t = TOOLS.find((x) => x.slug === slug)!;
                    return (
                      <a key={slug} href={`#/tools/${slug}`} className="focus-ring rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-bold text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:text-brand-400">
                        {t.name}
                      </a>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>
          <Reveal delay={200} className="hidden sm:block">
            <HeroVisual />
          </Reveal>
        </div>
        <div className="relative border-t border-ink-200/70 bg-white/70 dark:border-ink-800 dark:bg-ink-900/50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-4 py-4 text-[13px] font-bold text-ink-500 sm:justify-between sm:px-6 dark:text-ink-400">
            <span className="flex items-center gap-2"><Lock size={14} className="text-brand-600" aria-hidden /> No upload — ever</span>
            <span className="flex items-center gap-2"><BadgeCheck size={14} className="text-brand-600" aria-hidden /> 100% free</span>
            <span className="flex items-center gap-2"><Smartphone size={14} className="text-brand-600" aria-hidden /> Mobile friendly</span>
            <span className="flex items-center gap-2"><Zap size={14} className="text-brand-600" aria-hidden /> Instant browser processing</span>
            <span className="flex items-center gap-2"><Cpu size={14} className="text-brand-600" aria-hidden /> No account needed</span>
          </div>
        </div>
      </section>

      {/* ---------- Popular tools ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="popular">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="popular" className="font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-white">Most-used tools</h2>
            <p className="mt-2 text-ink-500 dark:text-ink-400">The essentials people reach for every day.</p>
          </div>
          <a href="#/tools" className="focus-ring group inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-brand-700 hover:underline dark:text-brand-400">
            Browse all {TOOLS.length} tools <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden />
          </a>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.slice(0, 4).map((t, i) => (
            <Reveal key={t.slug} delay={i * 70}><ToolCard tool={t} /></Reveal>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-ink-500 dark:text-ink-400">
          Plus 72 more tools across 10 categories
        </p>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="border-y border-ink-200/70 bg-white py-16 dark:border-ink-800 dark:bg-ink-900/40" aria-labelledby="cats">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <h2 id="cats" className="font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-white">Ten categories, one promise: private</h2>
            <p className="mt-2 max-w-2xl text-ink-500 dark:text-ink-400">Every category below runs on the same browser-only engine. Pick a lane or wander — nothing you do here leaves your device.</p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c, i) => (
              <Reveal key={c.slug} delay={(i % 3) * 70}><CategoryCard slug={c.slug} /></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works + benefits ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="how">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <h2 id="how" className="font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-white">How it works</h2>
            <p className="mt-2 text-ink-500 dark:text-ink-400">Three verbs. Zero servers.</p>
            <ol className="mt-8 space-y-0">
              {[
                ["Upload", "Drop a file into any tool. It is read straight into browser memory — never to a server."],
                ["Tune", "Sliders, presets and live previews show exactly what will happen before you commit."],
                ["Download", "The result is encoded on your device and saved. Close the tab; no trace remains."],
              ].map(([t, d], i) => (
                <li key={t} className="relative flex gap-5 pb-8 last:pb-0">
                  {i < 2 && <span className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-px bg-ink-200 dark:bg-ink-700" aria-hidden />}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-base font-bold text-white shadow-soft">{i + 1}</span>
                  <span>
                    <span className="block font-display text-lg font-bold text-ink-900 dark:text-white">{t}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-500 dark:text-ink-400">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
          <div className="space-y-4">
            <Reveal delay={80}>
              <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6 shadow-soft dark:border-brand-900 dark:from-brand-950/60 dark:to-ink-900">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900 dark:text-white"><ShieldCheck size={19} className="text-brand-600" aria-hidden /> The browser-only pipeline</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                  Your file travels exactly eight centimeters — from disk to RAM. Canvas and Web Workers do the pixel math; <span className="font-mono text-xs font-bold">canvas.toBlob()</span> hands you the result.
                </p>
                <div className="mt-5 flex items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-soft dark:bg-ink-900">
                  {[
                    [Upload, "Your file"],
                    [Cpu, "Canvas API"],
                    [Download, "Result"],
                  ].map(([Icon, label], i) => (
                    <div key={label as string} className="flex flex-1 items-center gap-2">
                      <span className="flex flex-col items-center gap-1.5">
                        <span className="rounded-lg bg-brand-100 p-2.5 text-brand-700 dark:bg-brand-900/70 dark:text-brand-300">{(() => { const I = Icon as typeof Upload; return <I size={17} aria-hidden />; })()}</span>
                        <span className="text-[11px] font-bold text-ink-500">{label as string}</span>
                      </span>
                      {i < 2 && <ArrowRight size={14} className="mx-auto shrink-0 text-brand-400" aria-hidden />}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              <Reveal delay={140}>
                <div className="h-full rounded-2xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
                  <Zap size={19} className="text-brand-600" aria-hidden />
                  <h3 className="mt-3 font-display text-[15px] font-bold text-ink-900 dark:text-white">Fast by architecture</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">No queue, no round-trip. Heavy work runs in Web Workers so the UI never freezes.</p>
                </div>
              </Reveal>
              <Reveal delay={200}>
                <div className="h-full rounded-2xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
                  <Smartphone size={19} className="text-brand-600" aria-hidden />
                  <h3 className="mt-3 font-display text-[15px] font-bold text-ink-900 dark:text-white">Pocket-sized studio</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">Every control is touch-friendly. Crop on the train, compress in the café.</p>
                </div>
              </Reveal>
              <Reveal delay={260}>
                <div className="h-full rounded-2xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
                  <Lock size={19} className="text-brand-600" aria-hidden />
                  <h3 className="mt-3 font-display text-[15px] font-bold text-ink-900 dark:text-white">Private by physics</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">We could not leak your images if we tried — they never reach us. Works offline after load.</p>
                </div>
              </Reveal>
              <Reveal delay={320}>
                <div className="h-full rounded-2xl border border-ink-200/70 bg-white p-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
                  <BadgeCheck size={19} className="text-brand-600" aria-hidden />
                  <h3 className="mt-3 font-display text-[15px] font-bold text-ink-900 dark:text-white">Honestly labeled</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">Classic algorithms, clearly explained. If a tool is not AI, we say so — because you deserve to know.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="border-t border-ink-200/70 bg-white py-16 dark:border-ink-800 dark:bg-ink-900/40" aria-labelledby="faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <h2 id="faq" className="font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-white">Questions, answered straight</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-6">
              <Accordion items={FAQS} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-ink-950 px-6 py-14 text-center shadow-lift sm:px-12 dark:bg-ink-900 dark:ring-1 dark:ring-ink-700">
            <div className="dots-bg absolute inset-0 opacity-40" aria-hidden />
            <div className="relative">
              <h2 className="mx-auto max-w-xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Your images deserve tools that respect them.</h2>
              <p className="mx-auto mt-3 max-w-lg text-ink-300">Start with the compressor — drop a photo in and watch the kilobytes melt. No sign-up, no upload, no catch.</p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => navigate("/tools/image-compressor")} className="px-6 py-3 text-[15px]">
                  Open Image Compressor <ArrowRight size={16} aria-hidden />
                </Button>
                <Button variant="secondary" onClick={() => navigate("/tools")} className="border-ink-600 bg-transparent px-6 py-3 text-[15px] text-white hover:border-brand-400 hover:text-brand-300 dark:bg-transparent dark:text-white">
                  Browse all tools
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
