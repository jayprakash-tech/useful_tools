# ClearImageTools

A complete, production-ready website of **75 free image tools** that run **100% in the browser**. No uploads, no accounts, no external APIs — every pixel is processed on the visitor's device using the HTML Canvas API, Web Workers and client-side libraries.

> **Live promise:** open your browser's network tab while using any tool — you will see zero image uploads.

## Features

- **75 working tools** across 9 categories: Compression, Conversion, Resize & Transform, Crop, Enhancement, Watermark & Text, Color & Analysis, Generators and Batch Tools
- Image compressor (single, batch, quality-reducer, target-size, resize+compress)
- Format conversion: JPG/PNG/WEBP/GIF/SVG/HEIC ↔ JPG/PNG/WEBP, Image→PDF, Images→ZIP, Base64 encode/decode, blob URL tool
- Resizer (px/percentage/aspect-ratio), interactive crop, fixed social sizes, profile picture maker
- Rotate, flip, mirror, rounded corners, borders, frames, drop shadows
- Enhancement: brightness, contrast, saturation, hue, grayscale, B&W threshold, sepia, invert, blur, convolution sharpen, histogram-based auto enhance (5 modes, honestly *not* AI), temperature, vignette, vintage presets, color overlay, duotone
- Watermarks (text, tiled, logo), text-on-image with drag placement, meme generator, badges, frames, social size maker
- Color picker, dominant colors, palette extractor (5/10/15), image info, EXIF viewer/remover, aspect-ratio & print-size calculators
- Favicon generator (5 sizes + HTML snippet + ZIP), placeholder/solid/gradient image generators, QR codes, Open Graph cards, before/after comparator
- Batch tools: resize, convert, rename, rounded corners, watermark — all with ZIP export
- **Registry-driven architecture** — add a tool by adding one object to `src/lib/tools.ts`
- Dark mode, fully responsive, accessible controls, toasts, live previews everywhere
- AdSense-ready: `AdSlot` placeholders in safe positions (top / sidebar / bottom), script only loads when configured

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Vite + React 18 + TypeScript (SPA, hash routing) |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |
| Compression | browser-image-compression (Web Worker) |
| Cropping | react-easy-crop (lazy-loaded) |
| PDF | jspdf (dynamic import) |
| ZIP | jszip (dynamic import) |
| EXIF | exifr (dynamic import) |
| HEIC | heic2any (dynamic import, WASM) |
| QR | qrcode (dynamic import) |

Heavy libraries are **dynamically imported** so they never block first paint.

## Getting started

```bash
npm install     # install dependencies
npm run dev     # local development
npm run build   # production build
npm start       # (Vite preview — use `npm run build` output for hosting)
```

## Environment variables

Copy `.env.example` to `.env`:

```
VITE_ADSENSE_CLIENT=          # e.g. ca-pub-1234567890123456 (after approval)
VITE_SITE_URL=http://localhost:5173
```

Without `VITE_ADSENSE_CLIENT`, safe "Advertisement" placeholders render instead of ad units.

## Deploy to Vercel

1. Create a GitHub repository and push this project
2. Go to [vercel.com](https://vercel.com) → **Import** the repository
3. Framework preset: **Vite**
4. Install command: `npm install`
5. Build command: `npm run build`
6. Output directory: `dist`
7. Add environment variables if needed (Settings → Environment Variables)
8. Deploy

### Custom domain

Vercel → project → **Settings → Domains** → add your domain and follow the DNS instructions (A record or CNAME). HTTPS is issued automatically.

> **AdSense note:** do not rely on the free `*.vercel.app` subdomain for AdSense. Connect your own custom domain (an approved domain) to reduce policy risk before applying.

## Configuring AdSense

1. Get approved with your custom domain
2. Set `VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX` in Vercel env vars
3. The AdSense loader (`src/App.tsx`) activates automatically
4. Replace the placeholder inside `AdSlot` (`src/components/shared.tsx`) with your `<ins class="adsbygoogle">` units and per-slot `data-ad-slot` IDs — the comments in that component show exactly where

Ad slots are deliberately placed **outside** tool controls: top of page, desktop sidebar, and page bottom.

## Adding a new tool

1. Add an entry to `src/lib/tools.ts` (slug, name, descriptions, category, icon, `panel`, FAQ, related tools)
2. Reuse an existing panel from `src/panels/` (most needs are covered by the ~30 panel components), or create a new panel component and register it in `src/panels/index.ts`
3. Done — the tool instantly appears on the home page, tools listing, category page, sitemap copy, search and related-tools slots

## Project structure

```
src/
  lib/            tools registry, categories, canvas engine, SEO helpers
  components/     UI kit, layout, dropzones/previews/ads, ToolLayout shell
  panels/         one file per tool family (compress, convert, transform,
                  effects, text, color, generators, batch)
  pages/          Home, Tools/Categories, ToolPage, static pages
public/           favicon, robots.txt, sitemap.xml
```

## Privacy

Images are processed locally in the browser and are **never uploaded**. No account is required. See `#/privacy-policy` in the app for the full policy.

## License

MIT — use freely. Attribution appreciated, not required.
