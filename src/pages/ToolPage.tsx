import { getTool } from "../lib/tools";
import { useSeo, SITE_NAME } from "../lib/seo";
import { ToolLayout } from "../components/ToolLayout";
import { PANELS } from "../panels";
import { NotFoundPage } from "./Static";

export function ToolPage({ slug }: { slug: string }) {
  const tool = getTool(slug);
  useSeo(
    tool ? `${tool.name} — Free Online Tool | ${SITE_NAME}` : `Tool not found | ${SITE_NAME}`,
    tool ? `${tool.short} Free, private and unlimited — all processing happens in your browser.` : undefined,
  );
  if (!tool) return <NotFoundPage />;
  const Panel = PANELS[tool.panel];
  return (
    <ToolLayout tool={tool}>
      {Panel ? <Panel tool={tool} /> : <p className="text-sm text-ink-500">This tool is being wired up.</p>}
    </ToolLayout>
  );
}
