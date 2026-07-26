// Generate the extension icon set (16/32/48/128 + 512 store master) from the
// SVG logo — renders the Q-PROS badge (grey circle, white ring, red center,
// white checkmark, red ribbons) at 4x supersampling and encodes PNG via
// Node's built-in zlib.
//
// Run: node scripts/generate-icons.mjs   (output: public/icons/icon-*.png)
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const SS = 4; // supersampling factor for anti-aliasing

// Logo colours (from icon.svg)
const GREY = [124, 124, 124];      // #7C7C7C outer circle
const WHITE = [255, 255, 255];     // #FFFFFF ring + checkmark
const RED = [224, 90, 85];         // #E05A55 center circle + ribbons
const TRANSPARENT = [0, 0, 0, 0];

// --- CRC32 (PNG chunk checksum) ---
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// --- Geometry helpers (SVG viewBox 0 0 100 130) ---
// Coordinate system: SVG space mapped to pixel space with supersampling.

function distToCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

// Point-in-triangle test (ribbons)
function inTriangle(px, py, x0, y0, x1, y1, x2, y2) {
  const d1 = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1);
  const d2 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d3 = (px - x0) * (y2 - y0) - (x2 - x0) * (py - y0);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

// Check if point is inside the checkmark stroke (thick line segment)
function distToSegment(px, py, x0, y0, x1, y1, thickness) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x0 + t * dx;
  const projY = y0 + t * dy;
  return Math.hypot(px - projX, py - projY) - thickness;
}

// Smooth edge helper: returns alpha 0-255 based on signed distance
function smoothEdge(dist, softness) {
  if (dist <= -softness) return 255;
  if (dist >= softness) return 0;
  return Math.round(255 * (0.5 - dist / (2 * softness)));
}

function renderIcon(size) {
  const hi = size * SS;
  const out = Buffer.alloc(size * size * 4);

  // SVG viewBox: 0 0 100 130 — map to hi×hi with aspect ratio preserved
  // Use uniform scale, center horizontally, align top
  const svgW = 100;
  const svgH = 130;
  const scale = hi / Math.max(svgW, svgH);
  const offsetX = (hi - svgW * scale) / 2;
  const offsetY = (hi - svgH * scale) / 2;

  function toScreen(sx, sy) {
    return [offsetX + sx * scale, offsetY + sy * scale];
  }

  const softness = scale * 0.5; // anti-aliasing edge width in hi-res pixels

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      let covered = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const hx = x * SS + sx + 0.5;
          const hy = y * SS + sy + 0.5;

          // Map to SVG coordinate space
          const svgX = (hx - offsetX) / scale;
          const svgY = (hy - offsetY) / scale;

          let pr, pg, pb, pa;

          // Layer 1: Red ribbons (behind the circle)
          // Left ribbon: M30 80 L15 125 L35 110 L50 120 Z
          if (inTriangle(svgX, svgY, 30, 80, 15, 125, 35, 110) ||
              inTriangle(svgX, svgY, 30, 80, 35, 110, 50, 120)) {
            [pr, pg, pb] = RED;
            pa = 255;
          }
          // Right ribbon: M70 80 L85 125 L65 110 L50 120 Z
          else if (inTriangle(svgX, svgY, 70, 80, 85, 125, 65, 110) ||
                   inTriangle(svgX, svgY, 70, 80, 65, 110, 50, 120)) {
            [pr, pg, pb] = RED;
            pa = 255;
          }
          // Layer 2: Outer grey circle (cx=50 cy=50 r=45)
          else if (distToCircle(svgX, svgY, 50, 50, 45) <= 0) {
            [pr, pg, pb] = GREY;
            pa = 255;
          }
          else {
            pa = 0; pr = 0; pg = 0; pb = 0;
          }

          // Layer 3: Inner white ring (cx=50 cy=50 r=35) — on top of grey
          if (pa > 0 && distToCircle(svgX, svgY, 50, 50, 35) <= 0) {
            [pr, pg, pb] = WHITE;
          }

          // Layer 4: Center red circle (cx=50 cy=50 r=28) — on top of white
          if (pa > 0 && distToCircle(svgX, svgY, 50, 50, 28) <= 0) {
            [pr, pg, pb] = RED;
          }

          // Layer 5: White checkmark — on top of red center
          // Checkmark: M38 52 L46 60 L62 40 (two segments)
          if (pa > 0) {
            const d1 = distToSegment(svgX, svgY, 38, 52, 46, 60, 3);
            const d2 = distToSegment(svgX, svgY, 46, 60, 62, 40, 3);
            const dCheck = Math.min(d1, d2);
            if (dCheck <= 0) {
              [pr, pg, pb] = WHITE;
            }
          }

          // Anti-alias the outer circle edge
          if (pa === 0) {
            const outerDist = distToCircle(svgX, svgY, 50, 50, 45);
            if (outerDist > -softness && outerDist < softness) {
              pa = smoothEdge(outerDist, softness);
              [pr, pg, pb] = GREY;
            }
          }

          r += pr;
          g += pg;
          b += pb;
          a += pa;
          if (pa > 0) covered += 1;
        }
      }
      const samples = SS * SS;
      const idx = (y * size + x) * 4;
      out[idx] = covered > 0 ? Math.round(r / covered) : 0;
      out[idx + 1] = covered > 0 ? Math.round(g / covered) : 0;
      out[idx + 2] = covered > 0 ? Math.round(b / covered) : 0;
      out[idx + 3] = Math.round(a / samples);
    }
  }
  return encodePng(size, size, out);
}

await mkdir(outDir, { recursive: true });
for (const size of [16, 32, 48, 128, 512]) {
  await writeFile(join(outDir, `icon-${size}.png`), renderIcon(size));
  console.log(`wrote public/icons/icon-${size}.png`);
}
