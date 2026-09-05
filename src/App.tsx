import { useEffect, useState } from "react";
import { Header, Footer } from "./components/layout";
import { ToastProvider } from "./components/ui";
import { HomePage } from "./pages/Home";
import { ToolsPage, CategoriesPage, CategoryPage } from "./pages/Tools";
import { ToolPage } from "./pages/ToolPage";
import { AboutPage, ContactPage, PrivacyPage, TermsPage, NotFoundPage } from "./pages/Static";

/** Loads the AdSense script once — only when a publisher ID is configured. */
function useAdSenseBootstrap() {
  useEffect(() => {
    const client = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? "";
    if (!client || document.querySelector("script[data-adsense]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-adsense", "true");
    document.head.appendChild(s);
  }, []);
}

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ""));
  useEffect(() => {
    const fn = () => setHash(window.location.hash.replace(/^#/, ""));
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return hash;
}

function Router() {
  const hash = useRoute();
  const path = hash.split("?")[0].replace(/\/+$/, "") || "/";

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  const parts = path.split("/").filter(Boolean); // e.g. ["tools","image-compressor"]

  if (parts.length === 0) return <HomePage />;
  if (parts[0] === "tools" && parts.length === 1) return <ToolsPage />;
  if (parts[0] === "tools" && parts.length === 2) return <ToolPage slug={parts[1]} />;
  if (parts[0] === "categories" && parts.length === 1) return <CategoriesPage />;
  if (parts[0] === "categories" && parts.length === 2) return <CategoryPage slug={parts[1]} />;
  if (path === "/about") return <AboutPage />;
  if (path === "/contact") return <ContactPage />;
  if (path === "/privacy-policy") return <PrivacyPage />;
  if (path === "/terms") return <TermsPage />;
  return <NotFoundPage />;
}

export default function App() {
  useAdSenseBootstrap();
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Router />
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
