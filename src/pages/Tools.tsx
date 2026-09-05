import { useMemo, useState } from "react";
import { Search, ChevronRight, FolderOpen } from "lucide-react";
import { TOOLS, searchTools, toolsByCategory } from "../lib/tools";
import { CATEGORIES, getCategory } from "../lib/categories";
import { useSeo, SITE_NAME } from "../lib/seo";
import { Badge, Reveal, cx } from "../components/ui";
import { ToolCard, CategoryCard, toolIcon } from "../components/shared";

export function ToolsPage() {
  useSeo(`All ${TOOLS.length} Free Image Tools | ${SITE_NAME}`, "Browse every free browser-based image tool: compressors, converters, resizers, croppers, enhancers, watermark tools, palette extractors, generators and batch utilities.");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const results = useMemo(() => {
    let list = q.trim() ? searchTools(q) : TOOLS;
    if (cat) list = list.filter((t) => t.cat === cat);
    return list;
  }, [q, cat]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-950 dark:text-white">All image tools</h1>
        <p className="mt-3 max-w-2xl text-ink-500 dark:text-ink-400">
          {TOOLS.length} free tools, one engine: your browser. Search or filter by category — every result is fully functional and private.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-soft focus-within:border-brand-500 dark:border-ink-700 dark:bg-ink-900">
          <Search size={17} className="shrink-0 text-ink-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, format or keyword…"
            aria-label="Search tools"
            className="w-full bg-transparent text-[15px] font-medium text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-100"
          />
          {q && <button onClick={() => setQ("")} className="focus-ring rounded text-xs font-bold text-ink-400 hover:text-ink-700 dark:hover:text-ink-200">Clear</button>}
        </div>
      </Reveal>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button onClick={() => setCat(null)} className={cx("focus-ring rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors", !cat ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300")}>
          All ({TOOLS.length})
        </button>
        {CATEGORIES.map((c) => {
          const n = toolsByCategory(c.slug).length;
          return (
            <button key={c.slug} onClick={() => setCat(cat === c.slug ? null : c.slug)} className={cx("focus-ring rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors", cat === c.slug ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300")}>
              {c.name} ({n})
            </button>
          );
        })}
      </div>

      {results.length === 0 ? (
        <div className="mt-16 flex flex-col items-center rounded-2xl border-2 border-dashed border-ink-200 py-16 text-center dark:border-ink-700">
          <FolderOpen size={34} className="text-ink-300" aria-hidden />
          <p className="mt-4 font-display text-lg font-bold text-ink-700 dark:text-ink-200">No tools match your search</p>
          <p className="mt-1 text-sm text-ink-400">Try a broader term like “resize”, “color” or “pdf”.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((t, i) => (
            <Reveal key={t.slug} delay={(i % 4) * 50}><ToolCard tool={t} /></Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoriesPage() {
  useSeo(`Tool Categories | ${SITE_NAME}`, "Browse ClearImageTools by category: compression, conversion, resize & transform, crop, enhancement, watermark & text, color & analysis, generators and batch tools.");
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-950 dark:text-white">Categories</h1>
        <p className="mt-3 max-w-2xl text-ink-500 dark:text-ink-400">Nine focused collections covering the whole image workflow — from shrinking a photo to shipping a favicon set.</p>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c, i) => (
          <Reveal key={c.slug} delay={(i % 3) * 70}><CategoryCard slug={c.slug} /></Reveal>
        ))}
      </div>
    </div>
  );
}

export function CategoryPage({ slug }: { slug: string }) {
  const cat = getCategory(slug);
  const tools = cat ? toolsByCategory(slug) : [];
  useSeo(
    cat ? `${cat.name} Tools — Free Online | ${SITE_NAME}` : `Category not found | ${SITE_NAME}`,
    cat ? `${cat.short} All ${tools.length} tools run 100% in your browser.` : undefined,
  );
  if (!cat) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Category not found</h1>
        <a href="#/categories" className="mt-4 inline-block font-bold text-brand-600 hover:underline">← Back to categories</a>
      </div>
    );
  }
  const Icon = toolIcon(cat.icon);
  const others = CATEGORIES.filter((c) => c.slug !== slug);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-400">
        <a href="#/" className="focus-ring rounded hover:text-brand-600">Home</a>
        <ChevronRight size={13} aria-hidden />
        <a href="#/categories" className="focus-ring rounded hover:text-brand-600">Categories</a>
        <ChevronRight size={13} aria-hidden />
        <span className="text-ink-700 dark:text-ink-200">{cat.name}</span>
      </nav>
      <Reveal>
        <header className="mt-6 flex items-start gap-5">
          <span className="rounded-xl bg-brand-600 p-4 text-white shadow-soft"><Icon size={28} aria-hidden /></span>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl dark:text-white">{cat.name} tools</h1>
            <p className="mt-2 max-w-2xl text-ink-500 dark:text-ink-400">{cat.short}</p>
            <Badge className="mt-3">{tools.length} tools · all free</Badge>
          </div>
        </header>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tools.map((t, i) => (
          <Reveal key={t.slug} delay={(i % 4) * 50}><ToolCard tool={t} /></Reveal>
        ))}
      </div>
      <section className="mt-14" aria-label="Related categories">
        <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Explore other categories</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((c) => (
            <a key={c.slug} href={`#/categories/${c.slug}`} className="focus-ring rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-[13px] font-bold text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">
              {c.name}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
