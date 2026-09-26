/**
 * AUREL — process the supplied hero film for scroll scrubbing.
 *
 * Raw video seeks badly when scrubbed. Re-encode to all-keyframe H.264 with no
 * audio, then pull the poster (first frame) and the ending frame (last frame,
 * reused as a free design asset lower down the page).
 *
 * The original asset is never modified — output goes to public/.
 *
 *   node scripts/encode-bg.mjs ../Assets/videos/aurel-hero.mp4
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const run = (args) => execFileSync(ffmpegPath, args, { stdio: "pipe", encoding: "utf8" });

const input = resolve(root, process.argv[2] ?? "../Assets/videos/aurel-hero.mp4");
if (!existsSync(input)) {
  console.error(`Missing hero film: ${input}`);
  process.exit(1);
}

mkdirSync(resolve(root, "public/img"), { recursive: true });

const OUT = resolve(root, "public/bg.mp4");
// All-keyframe is the whole point: every frame must be seekable. 14 MB keeps
// us under the 15 MB threshold where the blob loader would need a progress
// ring, and leaves room for the proven 10-second 720p source.
const TARGET_MB = 14;

/** Each attempt changes one variable, cheapest quality loss first. */
const attempts = [
  { label: "all-keyframe CRF 18", crf: 18, g: 1, keyint: 1, scale: null },
  { label: "keyframe every 4, CRF 18", crf: 18, g: 4, keyint: 4, scale: null },
  { label: "keyframe every 8, CRF 18", crf: 18, g: 8, keyint: 8, scale: null },
  { label: "keyframe every 8, CRF 22", crf: 22, g: 8, keyint: 8, scale: null },
  { label: "keyframe every 8, CRF 22, 1024 wide", crf: 22, g: 8, keyint: 8, scale: 1024 },
];

let chosen = null;
for (const a of attempts) {
  const vf = a.scale ? `scale=${a.scale}:-2,` : "";
  console.log(`encoding: ${a.label} ...`);
  run([
    "-y", "-i", input, "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", String(a.crf),
    "-g", String(a.g), "-keyint_min", String(a.keyint), "-sc_threshold", "0",
    "-vf", `${vf}format=yuv420p`,
    "-movflags", "+faststart",
    OUT,
  ]);
  const mb = statSync(OUT).size / 1048576;
  console.log(`  -> ${mb.toFixed(2)} MB`);
  if (mb <= TARGET_MB || a === attempts[attempts.length - 1]) {
    chosen = { ...a, mb };
    break;
  }
}

console.log(`chosen: ${chosen.label} (${chosen.mb.toFixed(2)} MB)`);

run(["-y", "-i", OUT, "-frames:v", "1", "-q:v", "2", resolve(root, "public/img/poster.jpg")]);
run([
  "-y", "-sseof", "-0.1", "-i", OUT, "-update", "1", "-frames:v", "1", "-q:v", "2",
  resolve(root, "public/img/ending.jpg"),
]);

console.log("wrote public/bg.mp4, public/img/poster.jpg, public/img/ending.jpg");
