import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { Tool } from "../lib/types";
import { getCategory } from "../lib/categories";
import { AdSlot, SeoContentBlock, RelatedTools, toolIcon, ToolCard } from "./shared";
import { Accordion, Badge, Reveal } from "./ui";
import { TOOLS } from "../lib/tools";

export function ToolLayout({ tool, children }: { tool: Tool; children: ReactNode }) {
  const cat = getCategory(tool.cat);
  const Icon = toolIcon(tool.icon);
  const popular = TOOLS.filter((x) => x.popular && x.slug !== tool.slug).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-ink-400">
        <a href="#/" className="focus-ring rounded hover:text-brand-600">Home</a>
        <ChevronRight size={13} aria-hidden />
        <a href="#/tools" className="focus-ring rounded hover:text-brand-600">Tools</a>
        {cat && (
          <>
            <ChevronRight size={13} aria-hidden />
            <a href={`#/categories/${cat.slug}`} className="focus-ring rounded hover:text-brand-600">{cat.name}</a>
          </>
        )}
        <ChevronRight size={13} aria-hidden />
        <span aria-current="page" className="text-ink-700 dark:text-ink-200">{tool.name}</span>
      </nav>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-brand-600 p-3.5 text-white shadow-soft">
            <Icon size={26} aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl dark:text-white">{tool.name}</h1>
            <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-400">{tool.short}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {cat && <Badge tone="neutral">{cat.name}</Badge>}
          <Badge tone="ok">Free · No upload</Badge>
        </div>
      </header>

      {/* Top ad — outside the tool controls */}
      <div className="mt-6">
        <AdSlot variant="top" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-12">
          <section aria-label={`${tool.name} tool`} className="rounded-2xl border border-ink-200/70 bg-white/60 p-4 shadow-soft sm:p-6 dark:border-ink-700/60 dark:bg-ink-900/50">
            {children}
          </section>

          <SeoContentBlock tool={tool} />

          <Reveal>
            <section aria-label="Frequently asked questions" className="rounded-xl border border-ink-200/70 bg-white px-5 shadow-soft dark:border-ink-700/60 dark:bg-ink-900">
              <h2 className="pt-5 font-display text-xl font-bold text-ink-900 dark:text-white">Frequently asked questions</h2>
              <div className="mt-1">
                <Accordion items={tool.faq} />
              </div>
            </section>
          </Reveal>

          <RelatedTools slugs={tool.related} />
        </div>

        <aside className="hidden space-y-6 lg:block" aria-label="Sidebar">
          <div className="sticky top-24 space-y-6">
            <AdSlot variant="sidebar" />
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">Popular tools</h2>
              <div className="mt-3 space-y-3">
                {popular.map((x) => <ToolCard key={x.slug} tool={x} />)}
              </div>
            </div>
            <AdSlot variant="sidebar" />
          </div>
        </aside>
      </div>

      {/* Bottom ad — after all tool functionality */}
      <div className="mt-12">
        <AdSlot variant="bottom" />
      </div>
    </div>
  );
}
