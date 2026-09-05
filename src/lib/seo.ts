import { useEffect } from "react";

export const SITE_NAME = "ClearImageTools";
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://clearimagetools.app";

export function useSeo(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);
}

export function navigate(path: string) {
  window.location.hash = path.startsWith("#") ? path : `#${path}`;
}
