/* =========================================================================
   AUREL - main.js
   The page is one cinematic film that plays forward as you scroll down and
   backward as you scroll up. Two rules make it smooth: the film is loaded as
   a Blob (hosts without HTTP Range support otherwise clamp every seek to
   zero), and a seek is never written while another seek is in flight.
   ========================================================================= */

import "./style.css";
import "./glass.css";

import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const base = import.meta.env.BASE_URL || "/";
const asset = (file) => `${base}${file}`;

/* A device only counts as touch-only when it fails both traits. `(hover: none)`
   on its own is true on plenty of touchscreen laptops, and that was enough to
   switch the film, the pins and the gallery off on a perfectly capable machine:
   the hero sat on the poster and nothing scrubbed. These two strings must match
   the media queries in style.css and glass.css, character for character. */
const TOUCH_ONLY = "(hover: none) and (pointer: coarse)";
const STATIC_HERO = matchMedia(
  `(max-width: 768px), ${TOUCH_ONLY}, (prefers-reduced-motion: reduce)`,
);
const NO_PIN = matchMedia(
  `(max-width: 1024px), ${TOUCH_ONLY}, (prefers-reduced-motion: reduce)`,
);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (min, max, v) => Math.min(max, Math.max(min, v));

/* ------------------------------------------------------------ smooth scroll */

const lenis = new Lenis({
  lerp: REDUCED.matches ? 1 : 0.1,
  smoothWheel: !REDUCED.matches,
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* --------------------------------------------------------------- the film */

const bgVideo = document.getElementById("bgv");
const posterEl = document.querySelector(".mobile-poster");

let seekBusy = false;
let pendingTime = null;
let lastVideoT = -1;
let seekTimer = null;
/* Whether the current viewport should be running the film at all. It separates a
   film that failed to load from a film that was put away on purpose when the
   window crossed the breakpoint, so tearing the film down never leaves the page
   convinced the video is broken. */
let filmWanted = false;

/* A browser only answers a seek with `seeked` once the decoder has produced the
   frame. On a slower GPU that can take noticeably longer than a frame, and if
   the answer never arrives the gate below would stay locked for good and the
   film would stop responding to the scroll. The timer is the release valve. */
const SEEK_TIMEOUT = 400;

function writeSeek(t) {
  seekBusy = true;
  lastVideoT = t;
  clearTimeout(seekTimer);
  seekTimer = setTimeout(releaseSeek, SEEK_TIMEOUT);
  try {
    bgVideo.currentTime = t;
  } catch {
    releaseSeek();
  }
}

/** Frees the gate and immediately retries the newest target, if there is one. */
function releaseSeek() {
  clearTimeout(seekTimer);
  seekTimer = null;
  seekBusy = false;
  if (pendingTime !== null) {
    const t = pendingTime;
    pendingTime = null;
    writeSeek(t);
  }
}

function requestSeek(t) {
  if (!bgVideo.duration) return;
  if (Math.abs(t - lastVideoT) < 0.008) return; // write only on change
  if (seekBusy) {
    pendingTime = t; // coalesce to the newest target
    return;
  }
  writeSeek(t);
}

bgVideo.addEventListener("seeked", releaseSeek);

function videoFailed() {
  if (!filmWanted) return;
  clearTimeout(seekTimer);
  seekTimer = null;
  seekBusy = false;
  pendingTime = null;
  document.body.classList.remove("video-ready");
  document.body.classList.add("video-failed");
}

bgVideo.addEventListener("error", videoFailed);

/* ----------------------------------------------------- scroll → video time */

/** Pinned sections hold the film back so it lingers where copy is densest. */
const slowZones = [];

/** Drops a pin's zone, so a trigger that has been killed stops shaping time. */
function dropZone(trigger) {
  const i = slowZones.findIndex((zone) => zone.trigger === trigger);
  if (i > -1) slowZones.splice(i, 1);
}

/**
 * Convert raw scroll position into the position the film should be at.
 * Segments outside a pin move 1:1; inside a pin they move at `k`.
 */
function effectiveScroll(y) {
  let out = 0;
  let last = 0;
  for (const zone of slowZones) {
    const st = zone.trigger;
    if (!st) continue;
    const zs = st.start;
    const ze = st.end;
    if (!Number.isFinite(zs) || !Number.isFinite(ze) || ze <= zs) continue;
    if (y <= zs) break;

    const segEnd = Math.min(y, zs);
    out += segEnd - last;
    last = segEnd;

    if (y <= ze) {
      out += (y - zs) * zone.k;
      return out;
    }
    out += (ze - zs) * zone.k;
    last = ze;
  }
  out += y - last;
  return out;
}

/**
 * The furthest the page can travel, read from the document.
 *
 * Lenis answers `limit` from cached dimensions that it only recalculates on a
 * debounce, and ScrollTrigger adds several viewport-heights of pin spacer after
 * that read has happened. Dividing by the short value made the film reach its
 * last frame before the page did and then sit still for the rest of the scroll.
 * The error is a multiple of the pin heights, which are viewport-height
 * multiples, so how wrong it got changed with the screen. The live document has
 * no such gap.
 */
function maxScroll() {
  const doc = document.scrollingElement || document.documentElement;
  return Math.max(1, doc.scrollHeight - window.innerHeight);
}

function scrubVideo() {
  if (!bgVideo.duration) return;
  const total = effectiveScroll(maxScroll());
  if (!Number.isFinite(total) || total <= 0) return;
  const p = clamp(0, 1, effectiveScroll(window.scrollY) / total);
  requestSeek(p * (bgVideo.duration - 0.05));
}

let filmRunning = false;
let filmOffScroll = null;

/** Loads the film as a Blob and wires it to the scroll. Idempotent. */
async function startFilm() {
  if (filmRunning) return;
  filmRunning = true;
  try {
    const res = await fetch(asset("bg.mp4"));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    // The window may have crossed the breakpoint while the film downloaded.
    if (!filmRunning) return;
    bgVideo.src = URL.createObjectURL(blob);
    bgVideo.load();
    bgVideo.addEventListener(
      "loadedmetadata",
      () => {
        scrubVideo();
        document.body.classList.remove("video-failed");
        document.body.classList.add("video-ready");
      },
      { once: true },
    );
    bgVideo.addEventListener("error", videoFailed, { once: true });
    filmOffScroll = lenis.on("scroll", scrubVideo);
  } catch {
    videoFailed();
  }
}

/** Releases the film so a resized or rotated window can fall back to the poster. */
function stopFilm() {
  if (!filmRunning) return;
  filmRunning = false;
  document.body.classList.remove("video-ready");
  filmOffScroll?.();
  filmOffScroll = null;
  clearTimeout(seekTimer);
  seekTimer = null;
  seekBusy = false;
  pendingTime = null;
  lastVideoT = -1;
  // Dropping the source releases the decoded frames. The resulting error event
  // is ignored, because filmWanted is already false by the time it lands.
  bgVideo.removeAttribute("src");
  bgVideo.load();
}

function applyHeroMode() {
  filmWanted = !STATIC_HERO.matches;
  if (filmWanted) {
    startFilm();
  } else {
    stopFilm();
  }
}

function initVideo() {
  if (posterEl) {
    posterEl.style.backgroundImage = `url("${asset("img/poster.jpg")}")`;
  }
  // Phones, tablets and reduced-motion visitors keep the composed still frame
  // and never download a byte of video.
  applyHeroMode();
}

/* The gates used to be read once, here. CSS media queries keep re-evaluating
   themselves, so a rotate or a resized window left the script and the
   stylesheet disagreeing about whether the film was running. */
STATIC_HERO.addEventListener("change", applyHeroMode);

initVideo();

/* ------------------------------------------------------- impact statement */

function setupImpact() {
  const section = document.querySelector("#impact");
  const pin = section?.querySelector(".impact__pin");
  const text = section?.querySelector("[data-split]");
  if (!section || !pin || !text) return null;

  // Split into words without losing punctuation or spacing.
  const raw = text.textContent.replace(/\s+/g, " ").trim();
  text.textContent = "";
  raw.split(" ").forEach((word, i, all) => {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = word;
    text.appendChild(span);
    if (i < all.length - 1) text.appendChild(document.createTextNode(" "));
  });

  const words = [...text.querySelectorAll(".word")];

  const render = (p) => {
    for (let i = 0; i < words.length; i++) {
      // Everything is settled by 54% so the statement holds fully lit for
      // roughly 85vh of scroll before the pin releases.
      const start = (i / Math.max(1, words.length)) * 0.45;
      const o = clamp(0, 1, (p - start) / 0.09);
      const w = words[i];
      w.style.opacity = String(0.12 + o * 0.88);
      w.style.transform = `translateY(${(1 - o) * 18}px)`;
      // The resting rule on .word is blur(8px), and opacity alone never
      // cleared it, so the statement finished soft. The blur rides the same
      // o ramp as everything else: identical start, identical stagger, and it
      // drops the filter entirely once settled so the type rasterises crisp.
      w.style.filter = o >= 1 ? "none" : `blur(${(1 - o) * 8}px)`;
    }
  };

  render(0);

  // Touch and reduced-motion devices get the reveal without the pin: the
  // statement un-blurs as the section passes instead of holding the page.
  if (STATIC_HERO.matches) {
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top 85%",
      end: "bottom 45%",
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => render(self.progress),
    });
    return { dispose: () => trigger.kill() };
  }

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${innerHeight * 1.9}`,
    pin,
    scrub: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => render(self.progress),
  });

  slowZones.push({ trigger, k: 0.18 });
  return {
    dispose: () => {
      dropZone(trigger);
      trigger.kill();
    },
  };
}

/* ---------------------------------------------------- the collection gallery */

function setupGallery() {
  const section = document.querySelector("#collection");
  const pin = section?.querySelector(".collection__pin");
  const cards = [...document.querySelectorAll("#collection-track [data-card]")];
  const counter = document.querySelector("[data-count]");
  if (!section || !pin || cards.length === 0) return null;

  const N = cards.length;

  // Below the pin breakpoint the cards are a plain stacked list and CSS owns
  // their visibility. Do not leave inline styles behind, or the stacked cards
  // inherit pointer-events and transforms from the gallery recipe.
  if (NO_PIN.matches) {
    cards.forEach((el) => {
      el.style.cssText = "";
    });
    if (counter) counter.textContent = "01";
    return null;
  }

  const render = (p) => {
    const pos = p * (N - 1);
    if (counter) {
      counter.textContent = String(Math.round(pos) + 1).padStart(2, "0");
    }
    cards.forEach((el, i) => {
      const d = pos - i;
      const ad = Math.abs(d);
      // A plateau at the centre of each card, so a card holds fully lit for
      // a whole scroll flick instead of passing through a single point.
      const o = ad <= 0.18 ? 1 : Math.max(0, 1 - (ad - 0.18) / 0.62);
      el.style.opacity = String(o);
      el.style.transform = `translate(${-d * 130}px, -50%) scale(${
        1 - Math.min(ad, 1) * 0.06
      })`;
      el.style.zIndex = String(100 - Math.round(ad * 10));
      el.style.pointerEvents = o > 0.6 ? "auto" : "none";
    });
  };

  render(0);

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${Math.max(1, N - 1) * innerHeight * 1.05}`,
    pin,
    scrub: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => render(self.progress),
  });

  slowZones.push({ trigger, k: 0.18 });
  return {
    dispose: () => {
      dropZone(trigger);
      trigger.kill();
      cards.forEach((el) => {
        el.style.cssText = "";
      });
      if (counter) counter.textContent = "01";
    },
  };
}

/* ---------------------------------------------------------------- parallax */

function setupParallax() {
  const media = document.querySelector("[data-parallax]");
  if (!media || STATIC_HERO.matches) return;
  gsap.fromTo(
    media,
    { yPercent: -5 },
    {
      yPercent: 5,
      ease: "none",
      scrollTrigger: {
        trigger: media.parentElement,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        invalidateOnRefresh: true,
      },
    },
  );
}

/* ------------------------------------------------------------- entrances */

function setupReveals() {
  const items = [...document.querySelectorAll(".reveal")];
  if (!items.length) return;

  let pending = items.slice();

  // A fast flick can jump an element clean past the observer's sampling, so
  // anything that has reached the viewport is revealed outright. Content is
  // never allowed to stay hidden because a scroll moved too quickly.
  function show(el) {
    el.classList.add("in");
    pending = pending.filter((x) => x !== el);
    io.unobserve(el);
  }

  function handleEntries(entries) {
    for (const entry of entries) {
      if (entry.isIntersecting) show(entry.target);
    }
  }

  const io = new IntersectionObserver(handleEntries, {
    rootMargin: "0px 0px -8% 0px",
    threshold: 0,
  });
  pending.forEach((el) => io.observe(el));

  function backstop() {
    if (!pending.length) return;
    for (const el of pending.slice()) {
      if (el.getBoundingClientRect().top < innerHeight * 0.9) show(el);
    }
  }

  lenis.on("scroll", backstop);
  window.addEventListener("scroll", backstop, { passive: true });
  backstop();
}

/* ------------------------------------------------------------------ chrome */

function setupChrome() {
  const nav = document.getElementById("nav");
  const marker = document.querySelector(".scroll-rail__marker");
  const rail = document.querySelector(".scroll-rail");

  const update = () => {
    const y = window.scrollY;
    nav?.classList.toggle("is-scrolled", y > 40);
    if (marker && rail) {
      const h = rail.clientHeight - marker.offsetHeight;
      const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      marker.style.top = `${clamp(0, 1, y / total) * h}px`;
    }
  };

  lenis.on("scroll", update);
  update();

  // Anchors go through Lenis so the film keeps scrubbing under them.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: -64, duration: 1.4 });
    });
  });
}

/* -------------------------------------------------------------- the form */

function setupForm() {
  const form = document.getElementById("enquiry");
  const note = document.getElementById("form-note");
  if (!form || !note) return;

  const TO = "studio@aurel-parfums.com";

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fields = [...form.querySelectorAll(".field")];
    let valid = true;
    fields.forEach((field) => {
      const input = field.querySelector("input, textarea");
      if (!input) return;
      const ok = input.checkValidity();
      field.classList.toggle("is-error", !ok);
      if (!ok) valid = false;
    });

    if (!valid) {
      note.textContent = "Please add your name, a valid email and a message.";
      note.classList.remove("is-success");
      return;
    }

    const data = new FormData(form);
    const subject = `AUREL enquiry: ${data.get("expression")}`;
    const body = [
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Expression: ${data.get("expression")}`,
      "",
      String(data.get("message") || ""),
    ].join("\n");

    note.textContent = `Thank you, ${data.get("name")}. Your mail app is opening, addressed to ${TO}.`;
    note.classList.add("is-success");
    form.reset();

    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  });
}

/* ------------------------------------------------------------ living page */

function setupVisibility() {
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("paused", document.hidden);
  });
}

/* ------------------------------------------------------------------ build */

let impact = null;
let gallery = null;

/** Rebuilds whichever pin the current viewport wants, dropping the other. */
function applyPins() {
  impact?.dispose();
  impact = setupImpact();
  gallery?.dispose();
  gallery = setupGallery();
}

impact = setupImpact();
gallery = setupGallery();
setupParallax();
setupReveals();
setupChrome();
setupForm();
setupVisibility();

/* Both gates move with the viewport, and CSS re-evaluates on its own, so a
   rotate or a resized window has to rebuild the pins here too. */
NO_PIN.addEventListener("change", applyPins);
STATIC_HERO.addEventListener("change", applyPins);

/* Every refresh, from any source: fonts landing, the window resizing, a pin
   being rebuilt. Lenis measures the document on a debounce, so it is told to
   re-measure before the film is mapped again, or the film is divided by a
   scroll range the page has already outgrown. */
ScrollTrigger.addEventListener("refresh", () => {
  lenis.resize();
  scrubVideo();
});

const refresh = () => ScrollTrigger.refresh();
if (document.fonts?.ready) document.fonts.ready.then(refresh);
window.addEventListener("load", refresh);
window.addEventListener("resize", () => {
  lenis.resize();
  scrubVideo();
});

scrubVideo();

// Used by the self-test in AGENTS.md §11.
window.__bgv = bgVideo;
window.__lenis = lenis;
window.__ST = ScrollTrigger;
window.__zones = slowZones;
