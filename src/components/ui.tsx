import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import clsx from "clsx";
import { Check, Copy, ChevronDown, Loader2, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { copyText } from "../lib/image";

export const cx = clsx;

/* ---------------- Button ---------------- */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
export function Button({
  variant = "primary",
  className,
  busy,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean }) {
  const styles: Record<BtnVariant, string> = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-ink-300 dark:disabled:bg-ink-700 disabled:text-white/70",
    secondary:
      "bg-white text-ink-800 border border-ink-200 hover:border-brand-400 hover:text-brand-700 dark:bg-ink-800 dark:text-ink-100 dark:border-ink-700 dark:hover:border-brand-500 dark:hover:text-brand-300 disabled:opacity-50",
    ghost:
      "bg-transparent text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 disabled:opacity-50",
    danger: "bg-rose-600/10 text-rose-700 border border-rose-300 hover:bg-rose-600 hover:text-white dark:border-rose-800 dark:text-rose-400 disabled:opacity-50",
    dark: "bg-ink-900 text-white hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white disabled:opacity-50",
  };
  return (
    <button
      className={cx(
        "btn-3d focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      disabled={busy || rest.disabled}
      {...rest}
    >
      {busy && <Loader2 size={16} className="spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------------- Card & Badge ---------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-xl border border-ink-200/70 bg-card shadow-soft dark:border-ink-700/60 dark:bg-ink-900", className)}>
      {children}
    </div>
  );
}

export function Badge({ className, children, tone = "brand" }: { className?: string; children: ReactNode; tone?: "brand" | "neutral" | "warn" | "ok" }) {
  const tones = {
    brand: "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200",
    neutral: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

/* ---------------- Form controls ---------------- */

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-bold text-ink-700 dark:text-ink-200">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "focus-ring w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cx(
          "focus-ring w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2 pr-9 text-sm font-medium text-ink-900 transition-colors focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100",
          props.className,
        )}
      />
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
    </div>
  );
}

export function SliderControl({
  label, value, min, max, step = 1, unit = "", onChange, defaultValue,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; defaultValue?: number;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-bold text-ink-700 dark:text-ink-200">{label}</label>
        <span className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-xs font-bold text-brand-700 tabular-nums dark:bg-ink-800 dark:text-brand-300">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min} max={max} step={step} value={value}
        style={{ ["--fill" as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {defaultValue !== undefined && value !== defaultValue && (
        <button
          onClick={() => onChange(defaultValue)}
          className="focus-ring rounded text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Reset to {defaultValue}{unit}
        </button>
      )}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring group flex w-full items-center justify-between rounded-lg px-1 py-1 text-left"
    >
      <span className="text-[13px] font-bold text-ink-700 dark:text-ink-200">{label}</span>
      <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-ink-300 dark:bg-ink-600")}>
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="focus-ring h-9 w-12 cursor-pointer rounded-md border border-ink-200 bg-white p-0.5 dark:border-ink-600 dark:bg-ink-800"
        />
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 font-mono uppercase"
          aria-label={`${label} hex value`}
        />
      </div>
    </Field>
  );
}

/* ---------------- Copy button ---------------- */

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }
      }}
      className={cx(
        "focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors",
        copied
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
          : "bg-ink-100 text-ink-600 hover:bg-brand-100 hover:text-brand-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-brand-900/50 dark:hover:text-brand-300",
        className,
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/* ---------------- Alert ---------------- */

export function Alert({ tone = "error", children }: { tone?: "error" | "warn" | "info" | "ok"; children: ReactNode }) {
  const map = {
    error: { cls: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300", Icon: AlertTriangle },
    warn: { cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300", Icon: Info },
    info: { cls: "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300", Icon: Info },
    ok: { cls: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300", Icon: CheckCircle2 },
  }[tone];
  const Icon = map.Icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium", map.cls)}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/* ---------------- Accordion / FAQ ---------------- */

export function Accordion({ items }: { items: [string, ReactNode][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-ink-200/70 dark:divide-ink-700/60">
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div key={q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="focus-ring flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className={cx("font-display text-[15px] font-semibold transition-colors", isOpen ? "text-brand-700 dark:text-brand-300" : "text-ink-800 dark:text-ink-100")}>
                {q}
              </span>
              <ChevronDown size={17} className={cx("shrink-0 text-ink-400 transition-transform duration-200", isOpen && "rotate-180 text-brand-600")} aria-hidden />
            </button>
            <div className={cx("grid transition-all duration-200 ease-out", isOpen ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <div className="overflow-hidden text-sm leading-relaxed text-ink-600 dark:text-ink-300">{a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Toast ---------------- */

type Toast = { id: number; msg: string; tone: "ok" | "error" | "info" };
const ToastCtx = createContext<(msg: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-72 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "toast-in pointer-events-auto flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-semibold shadow-lift",
              t.tone === "ok" && "border-emerald-300 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-ink-900 dark:text-emerald-300",
              t.tone === "error" && "border-rose-300 bg-white text-rose-800 dark:border-rose-800 dark:bg-ink-900 dark:text-rose-300",
              t.tone === "info" && "border-brand-300 bg-white text-brand-800 dark:border-brand-800 dark:bg-ink-900 dark:text-brand-300",
            )}
          >
            {t.tone === "ok" ? <CheckCircle2 size={16} /> : t.tone === "error" ? <AlertTriangle size={16} /> : <Info size={16} />}
            {t.msg}
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-auto text-ink-400 hover:text-ink-700" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Reveal on scroll ---------------- */

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    ob.observe(ref);
    return () => ob.disconnect();
  }, [ref]);
  return (
    <div ref={setRef} className={cx("reveal", inView && "reveal-in", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
