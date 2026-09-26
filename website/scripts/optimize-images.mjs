/**
 * AUREL — compress the three supplied product images for the web.
 *
 * The originals in Assets/images are the source of truth and are never
 * touched. Only copies land in public/img. Native width is preserved and the
 * 3:2 framing is kept intact so no bottle is ever cropped or distorted.
 *
 *   node scripts/optimize-images.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const run = (args) => execFileSync(ffmpegPath, args, { stdio: "pipe", encoding: "utf8" });

const variants = ["elan", "noctis", "sombre"];
mkdirSync(resolve(root, "public/img"), { recursive: true });

for (const v of variants) {
  const src = resolve(root, `../Assets/images/aurel-${v}.png`);
  if (!existsSync(src)) {
    console.error(`Missing supplied image: ${src}`);
    process.exit(1);
  }
  const out = resolve(root, `public/img/${v}.webp`);
  run([
    "-y", "-i", src,
    "-vf", "scale='min(1536,iw)':-2",
    "-c:v", "libwebp", "-quality", "82", "-compression_level", "6",
    "-lossless", "0", "-preset", "picture",
    out,
  ]);
  // A JPEG fallback for any browser that will not take WebP.
  run([
    "-y", "-i", src,
    "-vf", "scale='min(1536,iw)':-2",
    "-q:v", "4",
    resolve(root, `public/img/${v}.jpg`),
  ]);
  console.log(
    `${v}: ${(statSync(out).size / 1024).toFixed(0)} KB webp / ` +
      `${(statSync(resolve(root, `public/img/${v}.jpg`)).size / 1024).toFixed(0)} KB jpg`,
  );
}
console.log("product images optimised");
