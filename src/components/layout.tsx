import { useEffect, useState } from "react";
import { Menu, X, Sun, Moon, ShieldCheck, Mail } from "lucide-react";
import { cx } from "./ui";
import { CATEGORIES } from "../lib/categories";
import { TOOLS } from "../lib/tools";
import { SITE_NAME } from "../lib/seo";

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <a href="#/" className="focus-ring group flex items-center gap-2.5 rounded-lg" aria-label="ClearImageTools home">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden className="transition-transform duration-300 group-hover:rotate-90">
        <rect x="1.5" y="1.5" width="31" height="31" rx="9" className="fill-brand-600" />
        <rect x="1.5" y="1.5" width="31" height="31" rx="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <path d="M17 7.5 26.5 17 17 26.5 7.5 17Z" fill="rgba(255,255,255,0.28)" />
        <circle cx="17" cy="17" r="4.6" fill="#fff" />
        <circle cx="17" cy="17" r="2.1" className="fill-brand-600" />
      </svg>
      {!compact && (
        <span className="font-display text-[17px] font-bold tracking-tight text-ink-900 dark:text-white">
          Clear<span className="text-brand-600 dark:text-brand-400">Image</span>Tools
        </span>
      )}
    </a>
  );
}

const NAV = [
  { label: "Home", href: "#/", match: (h: string) => h === "" || h === "/" },
  { label: "Tools", href: "#/tools", match: (h: string) => h.startsWith("/tools") },
  { label: "Categories", href: "#/categories", match: (h: string) => h.startsWith("/categories") },
  { label: "About", href: "#/about", match: (h: string) => h === "/about" },
  { label: "Contact", href: "#/contact", match: (h: string) => h === "/contact" },
];

function useHashPath() {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ""));
  useEffect(() => {
    const fn = () => setHash(window.location.hash.replace(/^#/, ""));
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return hash;
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cit-theme", next ? "dark" : "light");
    } catch {
      /* private mode */
    }
  };
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="focus-ring rounded-lg border border-ink-200 bg-white p-2 text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:text-brand-400"
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function Header() {
  const hash = useHashPath();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [hash]);
  return (
    <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-paper/90 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={n.href}
              aria-current={n.match(hash) ? "page" : undefined}
              className={cx(
                "focus-ring rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                n.match(hash)
                  ? "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white",
              )}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 sm:flex dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
            <ShieldCheck size={12} aria-hidden /> 100% in-browser
          </div>
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="focus-ring rounded-lg border border-ink-200 bg-white p-2 text-ink-700 md:hidden dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t border-ink-200/70 bg-paper px-4 py-3 md:hidden dark:border-ink-800 dark:bg-ink-950" aria-label="Mobile navigation">
          <div className="flex flex-col gap-1">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className={cx(
                  "focus-ring rounded-lg px-3 py-2.5 text-sm font-semibold",
                  n.match(hash) ? "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300" : "text-ink-700 dark:text-ink-200",
                )}
              >
                {n.label}
              </a>
            ))}
            <p className="mt-2 flex items-center gap-1.5 px-3 text-xs font-semibold text-ink-500">
              <ShieldCheck size={13} className="text-emerald-600" aria-hidden /> Your images never leave your device.
            </p>
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const popular = TOOLS.filter((t) => t.popular).slice(0, 6);
  return (
    <footer className="mt-20 border-t border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            Free image tools that run entirely in your browser. Compress, convert, resize and enhance — privately, instantly, on any device.
          </p>
          <a
            href="#/contact"
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-brand-400"
          >
            <Mail size={15} aria-hidden /> Get in touch
          </a>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-800 dark:text-ink-100">Popular tools</h3>
          <ul className="mt-4 space-y-2.5">
            {popular.map((t) => (
              <li key={t.slug}>
                <a href={`#/tools/${t.slug}`} className="focus-ring rounded text-sm text-ink-500 transition-colors hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-400">
                  {t.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-800 dark:text-ink-100">Categories</h3>
          <ul className="mt-4 space-y-2.5">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <a href={`#/categories/${c.slug}`} className="focus-ring rounded text-sm text-ink-500 transition-colors hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-400">
                  {c.name}
                </a>
              </li>
            ))}
            <li>
              <a href="#/categories" className="focus-ring rounded text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
                All categories →
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-800 dark:text-ink-100">Site</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ["All tools", "#/tools"],
              ["About", "#/about"],
              ["Contact", "#/contact"],
              ["Privacy Policy", "#/privacy-policy"],
              ["Terms of Service", "#/terms"],
            ].map(([label, href]) => (
              <li key={href}>
                <a href={href} className="focus-ring rounded text-ink-500 transition-colors hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-400">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-200/70 dark:border-ink-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-400 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} {SITE_NAME}. All processing happens locally in your browser.</p>
          <p className="font-semibold">No uploads · No accounts · No watermarks on output</p>
        </div>
      </div>
    </footer>
  );
}
