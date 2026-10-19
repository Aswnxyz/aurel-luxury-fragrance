# AUREL — Luxury Fragrance Experience

> **Composed in shadow, worn in light.**

AUREL is a cinematic luxury fragrance website concept designed around atmosphere, storytelling, and scroll-driven interaction. The experience presents a fictional Parisian fragrance house and its three expressions — **Élan**, **Noctis**, and **Sombre** — through immersive visuals, editorial typography, and motion.

## ✨ Highlights

- Cinematic scroll-driven hero experience
- Scroll-controlled background video with forward/reverse playback
- Smooth scrolling powered by Lenis
- GSAP-powered transitions and scroll animations
- Editorial luxury typography and dark, warm visual direction
- Dedicated sections for composition, flacon, design & materials, collection, and specifications
- Responsive layouts for desktop and mobile
- Reduced-motion support
- Interactive enquiry form with mail-app handoff
- Static asset processing scripts and a Vite production build workflow

## 🛠️ Built With

- **HTML5**
- **CSS3**
- **JavaScript (ES Modules)**
- **Vite**
- **GSAP** — animations and scroll-driven motion
- **Lenis** — smooth scrolling
- **FFmpeg** — video processing and optimization

## 📐 Experience Structure

1. **Hero** — AUREL introduction and cinematic opening
2. **Brand Statement** — Editorial statement revealed through scroll
3. **01 / The Composition** — Fragrance notes and structure
4. **02 / The Flacon** — Bottle construction and specifications
5. **03 / Design and Materials** — Smoked glass, brushed gold, and material details
6. **04 / The Collection** — Élan, Noctis, and Sombre
7. **05 / Specifications** — Product information and technical details
8. **Enquiries** — Collection request and contact experience

## Getting started

The application is in `website/`. From the repository root:

```bash
cd website
npm ci
npm run dev
```

Open the localhost URL printed by Vite. For a production bundle:

```bash
npm run build
npm run preview
```

The build writes `website/dist/`. Serve it over HTTP; opening HTML through `file://` prevents the video-fetch workflow from operating normally. There is no backend database or environment-variable setup for the website.

## Demo and project status

[View the concept](https://aurel-luxury-fragrance.vercel.app). The homepage responded on 18 October 2026. AUREL is a fictional brand and a frontend concept, not a commissioned commercial store. The enquiry form opens a mail app with placeholder contact details; it does not submit to a backend or confirm message delivery.

## Engineering details

- **Scroll-driven interaction:** GSAP ScrollTrigger coordinates section motion and video progress; Lenis feeds the shared animation ticker.
- **Video seeking:** the film is fetched as a Blob; seek requests are gated and coalesced, with a timeout to recover from a stalled seek. This avoids repeatedly requesting obsolete frames.
- **Responsive and reduced-motion behavior:** narrow screens, touch-only devices and reduced-motion preferences use the still-image hero. Reduced motion disables smooth-wheel scrolling, and the CSS provides corresponding fallbacks. This is implemented support, not a complete accessibility certification.
- **Performance trade-off:** Blob loading makes seeking independent of HTTP Range behavior, but downloads the video into memory. Poster fallbacks and avoiding video on the static-hero path reduce that cost. No benchmark score is claimed.
- **Media processing:** `npm run encode` and `npm run optimize-images` generate assets. They are optional for running the already-committed website; inspect their input paths before using them. Encoding uses FFmpeg tooling.

## Structure and validation

`website/src/main.js` contains motion, video and form behavior; `style.css` and `glass.css` define the layouts and visual treatment. `website/scripts/` contains media-processing scripts and `website/public/` holds processed assets. [The implementation guide](website/README.md) retains detailed hosting and media notes.

There is no automated test or lint script in the package. Run `npm run build`, then check desktop forward/reverse scrolling, mobile layout, reduced-motion mode, video failure fallback, keyboard navigation and form validation. A mail-app handoff is not proof an enquiry was sent. Review placeholder brand contacts before reusing the concept for a real business.
