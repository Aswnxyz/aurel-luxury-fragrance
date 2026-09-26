# AUREL

Composed in shadow, worn in light.

A scroll-driven showcase for AUREL, a Paris house of three eaux de parfum:
**Élan** for daylight, **Noctis** for night, **Sombre** for the hours in
between.

The whole page sits over one cinematic film. It plays forward as you scroll
down and backward as you scroll up, so the visitor controls the camera. When
the film reaches its composed final frame, the page comes to rest on the
enquiry card.

---

## Run it

```bash
cd website
npm install
npm run dev
```

Open the localhost link it prints in a real browser. Scroll-video pages do not
behave honestly in an embedded preview pane, so the browser is the truth.

Build:

```bash
npm run build
```

That writes a portable static bundle to `website/dist` (relative base, so it
can live at a domain root or in a subfolder). Serve the **contents** of `dist`
over HTTP. Never open it via `file://`, because `fetch` is blocked there and
the film falls back to the still frame on purpose.

## Before going live

- `og:url` and `og:image` in `index.html` are **relative** (`./img/ending.jpg`).
  Social previews need absolute URLs, so patch them with the live domain just
  before the final build.
- Build with `npm run build` and upload the **contents** of `website/dist`,
  with `index.html` at the top level. Uploading the `dist` folder itself shows
  a directory listing instead of the site.
- The relative base (`base: "./"`) means the site works at a domain root or in
  a subfolder. It has been verified in a subfolder.

## Processed media

| Command | What it does |
|---|---|
| `npm run encode` | Re-encodes `../Assets/videos/aurel-hero.mp4` to all-keyframe `public/bg.mp4` (12.4 MB), then writes `public/img/poster.jpg` and `public/img/ending.jpg` |
| `npm run optimize-images` | Compresses the three supplied product PNGs to `public/img/*.webp` and `*.jpg` |

Both write **copies** into `website/public/`. Nothing in `Assets/` is ever
modified, renamed or overwritten.

## Where a visitor's message goes

The enquiry form does not post to a server. On submit it validates the fields,
shows a confirmation state on the page, and then opens the visitor's own mail
app with the message addressed to:

```
studio@aurel-parfums.com
```

So the message ends up in the visitor's outbox, and they press send. If you
want it delivered without a mail app, the form needs a real endpoint (Formspree,
a hostinger form handler, or your own API) and the `setupForm` function in
`src/main.js` is the single place to change.

**These contact details are placeholders.** Replace them in `index.html`
(footer and form note), in `src/main.js` (the `TO` constant), and in
`copy/brand-kit.md` before going live:

- studio@aurel-parfums.com
- +33 1 84 80 00 00
- instagram.com/aurel.parfums
- 12 Rue des Ombres, 75003 Paris, France

## How the film works

- The file is fetched as a **Blob** and played from an object URL. Shared hosts
  often lack HTTP Range support, which makes `currentTime` seeks clamp to zero
  in production while working perfectly on localhost.
- Seeks are **gated**: a new `currentTime` is never written while a seek is in
  flight. Piled-up seeks are the difference between smooth and choppy.
- The source is all-keyframe H.264, so every frame is seekable.
- Scroll maps to film progress across the whole page. The two pinned sections
  act as slow zones at 0.18×, so the film lingers where the copy is densest.
- Phones, touch devices and `prefers-reduced-motion` get the composed still
  frame and never download the video at all.

## Layout

```
copy/brand-kit.md          every brand decision
Assets/                    supplied source assets, untouched
website/
  index.html
  src/main.js              film scrub, pins, entrances, form
  src/style.css            tokens, layout, sections
  src/glass.css            smoked-glass panels
  scripts/encode-bg.mjs    film processing
  scripts/optimize-images.mjs
  public/bg.mp4            processed film
  public/img/              poster, ending frame, product images
```

Brand decisions live in `copy/brand-kit.md`. This README only explains how the
thing is built.
