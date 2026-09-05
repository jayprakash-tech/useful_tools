import type { ReactNode } from "react";
import { Mail, ShieldCheck, ArrowLeft, MessageSquare } from "lucide-react";
import { useSeo, SITE_NAME } from "../lib/seo";
import { Reveal, Button } from "../components/ui";

function PageShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Reveal>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-950 dark:text-white">{title}</h1>
        {intro && <p className="mt-4 text-lg leading-relaxed text-ink-500 dark:text-ink-300">{intro}</p>}
      </Reveal>
      <Reveal delay={100}>
        <div className="mt-10 space-y-8">{children}</div>
      </Reveal>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-ink-900 dark:text-white">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-600 dark:text-ink-300">{children}</div>
    </section>
  );
}

export function AboutPage() {
  useSeo(`About | ${SITE_NAME}`, "ClearImageTools is a collection of 75 free image tools that run entirely in your browser — no uploads, no accounts, no AI black boxes.");
  return (
    <PageShell title="About ClearImageTools" intro="A workshop of 75 image tools with one founding rule: your images never leave your device.">
      <Section heading="What this site does">
        <p>ClearImageTools provides free online image utilities: compression, format conversion, resizing, cropping, enhancement, watermarking, color analysis and generators. Every tool is a real, working program that runs on the HTML Canvas API, Web Workers and carefully chosen open-source libraries — right inside your browser tab.</p>
      </Section>
      <Section heading="Why it exists">
        <p>Most "free" image tools quietly upload your photos to a server, resize them on someone else's hardware, and may keep a copy. For holiday photos that is uncomfortable; for client work, IDs or unreleased product shots it is unacceptable. We built the alternative: the same capabilities, delivered as pure client-side software. Open your network inspector while using any tool — you will see zero image traffic.</p>
      </Section>
      <Section heading="Who it is for">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Web developers</strong> compressing assets and generating favicons or OG images.</li>
          <li><strong>Content creators</strong> preparing correctly sized visuals for every platform.</li>
          <li><strong>Photographers</strong> stripping EXIF/GPS data before sharing.</li>
          <li><strong>Office workers</strong> turning scans into PDFs or shrinking attachments under email limits.</li>
          <li><strong>Anyone</strong> who thinks privacy should be the default, not a premium feature.</li>
        </ul>
      </Section>
      <Section heading="Honest engineering">
        <p>When a tool uses a classic histogram stretch, we call it that — not "AI enhancement". When results are approximate, we say so. When a browser lacks a codec (like HEIC on some systems), we explain it clearly instead of failing silently.</p>
        <p className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-400"><ShieldCheck size={17} aria-hidden /> Questions or ideas? <a href="#/contact" className="underline">Get in touch.</a></p>
      </Section>
    </PageShell>
  );
}

export function ContactPage() {
  useSeo(`Contact | ${SITE_NAME}`, "Contact the ClearImageTools team — report a bug, request a tool or just say hello.");
  const email = "hello@clearimagetools.app";
  return (
    <PageShell title="Contact" intro="Bug reports, tool requests and kind words all welcome. This site has no backend, so the most reliable channel is good old email.">
      <div className="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-soft sm:p-8 dark:border-ink-700/60 dark:bg-ink-900">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-600 p-3 text-white"><Mail size={20} aria-hidden /></span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Email us</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400">We read everything and reply to most.</p>
          </div>
        </div>
        <p className="mt-5 rounded-xl bg-ink-50 px-4 py-3 font-mono text-sm font-bold text-brand-700 dark:bg-ink-800 dark:text-brand-300">{email}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={`mailto:${email}?subject=${encodeURIComponent("Tool request")}`}>
            <Button><MessageSquare size={15} aria-hidden /> Request a tool</Button>
          </a>
          <a href={`mailto:${email}?subject=${encodeURIComponent("Bug report")}`}>
            <Button variant="secondary">Report a bug</Button>
          </a>
        </div>
      </div>
      <Section heading="When reporting a bug, include">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>The tool name (from the page title)</li>
          <li>Your browser and version (e.g. Chrome 126, Safari 17)</li>
          <li>What you expected vs. what happened</li>
          <li>Image format and approximate size — never the image itself</li>
        </ul>
      </Section>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <strong>Privacy note:</strong> we cannot see your images, so please do not attach sensitive files to emails about the tools.
      </div>
    </PageShell>
  );
}

export function PrivacyPage() {
  useSeo(`Privacy Policy | ${SITE_NAME}`, "How ClearImageTools protects your privacy: images are processed locally in your browser and never uploaded.");
  return (
    <PageShell title="Privacy Policy" intro="The short version: your images never touch our servers, because there is no server-side processing to touch.">
      <Section heading="1. Browser-only processing">
        <p>Every tool on this site performs its work locally in your browser using the HTML Canvas API, JavaScript and Web Workers. When you select or drop an image, it is read directly into your browser's memory, processed on your device, and offered back to you as a download. No image data is transmitted to us or to any third party for processing.</p>
      </Section>
      <Section heading="2. No accounts, no tracking of your files">
        <p>We do not require registration and we do not maintain user profiles. We never see, store, index or scan the images you process. Once you close the tab, the in-memory data is gone.</p>
      </Section>
      <Section heading="3. Cookies & analytics">
        <p>The site may use minimal, privacy-respecting analytics to understand aggregate usage (pages visited, approximate region). These do not identify you personally and are never combined with your files. If advertising is enabled, advertising partners may use cookies as described below.</p>
      </Section>
      <Section heading="4. Advertising">
        <p>This site may display advertisements (for example via Google AdSense) to keep the tools free. Ad networks may use cookies and similar technologies to serve relevant ads. You can opt out of personalized advertising in your Google ad settings or your browser's privacy controls. Ads are placed away from tool controls and never require interaction to use a tool.</p>
      </Section>
      <Section heading="5. Third-party links">
        <p>The site may link to external resources. We are not responsible for the privacy practices of other websites.</p>
      </Section>
      <Section heading="6. Your responsibility">
        <p>You retain all rights to the images you process. You are responsible for ensuring you have the right to use and modify any image you load into the tools.</p>
      </Section>
      <Section heading="7. Changes & contact">
        <p>If this policy changes, the updated version will be posted here with a new effective date. Questions? Email <span className="font-mono font-bold">hello@clearimagetools.app</span>.</p>
        <p className="text-sm text-ink-400">Last updated: January 2025</p>
      </Section>
    </PageShell>
  );
}

export function TermsPage() {
  useSeo(`Terms of Service | ${SITE_NAME}`, "The terms of service for ClearImageTools — free browser-based image tools provided as-is.");
  return (
    <PageShell title="Terms of Service" intro="Plain-language terms for using the tools. The spirit: use them freely, responsibly, and as-is.">
      <Section heading="1. The service">
        <p>ClearImageTools provides free, browser-based image utilities. The software runs on your own device; we provide the code and hosting for the interface only.</p>
      </Section>
      <Section heading="2. As-is, no warranty">
        <p>The tools are provided "as is" and "as available" without warranties of any kind, express or implied — including fitness for a particular purpose or accuracy of output. Always keep your original files; re-encoding is inherently lossy for some formats.</p>
      </Section>
      <Section heading="3. Acceptable use">
        <p>You agree not to use the tools to process content that is unlawful, infringes the rights of others, or that you do not have permission to use. You are solely responsible for the images you process and for how you use the outputs.</p>
      </Section>
      <Section heading="4. Intellectual property">
        <p>We claim no ownership over the images you process or the files you generate. You are responsible for ensuring you hold the necessary rights to any input image and for complying with licenses and privacy laws (for example, when removing or preserving metadata).</p>
      </Section>
      <Section heading="5. Limitation of liability">
        <p>To the maximum extent permitted by law, we shall not be liable for indirect, incidental or consequential damages — including lost data, lost profits or missed deadlines — arising from the use of the tools.</p>
      </Section>
      <Section heading="6. Advertising">
        <p>The service may be supported by advertising. Ad placements do not affect tool functionality, and interacting with ads is always optional.</p>
      </Section>
      <Section heading="7. Changes">
        <p>We may update these terms from time to time; continued use after posting constitutes acceptance. Questions? <span className="font-mono font-bold">hello@clearimagetools.app</span>.</p>
        <p className="text-sm text-ink-400">Last updated: January 2025</p>
      </Section>
    </PageShell>
  );
}

export function NotFoundPage() {
  useSeo(`Page not found | ${SITE_NAME}`);
  return (
    <div className="dots-bg flex min-h-[60vh] items-center justify-center px-4 py-20">
      <div className="text-center">
        <p className="font-display text-[88px] font-bold leading-none text-brand-600/25">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-950 dark:text-white">This page was cropped out</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-500 dark:text-ink-400">The URL you followed does not exist. The tools, however, very much do — all 75 of them.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#/tools"><Button>Explore tools</Button></a>
          <a href="#/"><Button variant="secondary"><ArrowLeft size={15} aria-hidden /> Back home</Button></a>
        </div>
      </div>
    </div>
  );
}
